#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

BACKUP_ROOT="${ROOT_DIR}/backups/prod"

stack_is_running() {
  [[ -n "$(stack_compose ps -q db 2>/dev/null)" ]]
}

app_is_running() {
  [[ -n "$(app_compose ps -q app 2>/dev/null)" ]]
}

create_snapshot() {
  require_commands docker sha256sum
  require_stack_env

  local timestamp backup_dir stack_was_running=false app_was_running=false
  timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  backup_dir="${BACKUP_ROOT}/${timestamp}"
  mkdir -p "${BACKUP_ROOT}"
  mkdir "${backup_dir}"
  chmod 700 "${BACKUP_ROOT}" "${backup_dir}"

  if stack_is_running; then
    stack_was_running=true
  fi
  if app_is_running; then
    app_was_running=true
    app_compose stop
  fi
  if [[ "${stack_was_running}" == "true" ]]; then
    stack_compose stop "${CORE_STACK_SERVICES[@]}"
  fi

  local backup_status=0
  set +e
  stack_compose run --rm --no-deps -T --entrypoint tar db \
    -C /var/lib/postgresql -czf - data >"${backup_dir}/db-data.tar.gz"
  backup_status=$?
  if ((backup_status == 0)); then
    stack_compose run --rm --no-deps -T --entrypoint tar db \
      -C /etc/postgresql-custom -czf - . >"${backup_dir}/db-config.tar.gz"
    backup_status=$?
  fi
  set -e

  if ((backup_status != 0)); then
    if [[ "${stack_was_running}" == "true" ]]; then
      stack_compose up -d --wait --wait-timeout 180 "${CORE_STACK_SERVICES[@]}"
    fi
    if [[ "${app_was_running}" == "true" ]]; then
      app_compose up -d --no-build --wait --wait-timeout 180
    fi
    echo "backup failed; previous service state was restored" >&2
    return "${backup_status}"
  fi

  load_stack_version
  {
    printf 'created_at=%s\n' "${timestamp}"
    printf 'supabase_ref=%s\n' "${SUPABASE_UPSTREAM_REF}"
    printf 'app_ref=%s\n' "$(git -C "${ROOT_DIR}" rev-parse HEAD)"
  } >"${backup_dir}/metadata.env"
  (
    cd "${backup_dir}"
    sha256sum db-data.tar.gz db-config.tar.gz metadata.env >SHA256SUMS
  )
  printf '%s\n' "${backup_dir}" >"${BACKUP_ROOT}/latest"
  chmod 600 "${backup_dir}"/* "${BACKUP_ROOT}/latest"

  if [[ "${stack_was_running}" == "true" ]]; then
    stack_compose up -d --wait --wait-timeout 180 "${CORE_STACK_SERVICES[@]}"
  fi
  if [[ "${app_was_running}" == "true" ]]; then
    app_compose up -d --no-build --wait --wait-timeout 180
  fi

  echo "backup created: ${backup_dir}"
}

resolve_backup_dir() {
  local requested="${1:-}"
  if [[ -z "${requested}" ]]; then
    if [[ ! -f "${BACKUP_ROOT}/latest" ]]; then
      echo "no latest production backup is recorded" >&2
      exit 1
    fi
    requested="$(<"${BACKUP_ROOT}/latest")"
  elif [[ "${requested}" != /* ]]; then
    requested="${ROOT_DIR}/${requested}"
  fi

  if [[ ! -f "${requested}/SHA256SUMS" ]]; then
    echo "invalid backup directory: ${requested}" >&2
    exit 1
  fi
  printf '%s\n' "${requested}"
}

restore_snapshot() {
  local backup_arg="${1:-}" confirmation="${2:-}"
  if [[ "${confirmation}" != "--confirm" ]]; then
    echo "restore is destructive; rerun with: mise run prod:db:rollback -- <backup-dir> --confirm" >&2
    exit 1
  fi

  require_commands docker sha256sum
  local backup_dir
  backup_dir="$(resolve_backup_dir "${backup_arg}")"
  (
    cd "${backup_dir}"
    sha256sum --check SHA256SUMS
  )

  load_stack_version
  local backup_ref
  backup_ref="$(read_env_value "${backup_dir}/metadata.env" "supabase_ref")"
  if [[ "${backup_ref}" != "${SUPABASE_UPSTREAM_REF}" ]]; then
    echo "backup Supabase ref ${backup_ref} does not match current pin ${SUPABASE_UPSTREAM_REF}" >&2
    exit 1
  fi

  local app_was_running=false
  if app_is_running; then
    app_was_running=true
    app_compose stop
  fi
  if stack_is_running; then
    stack_compose stop "${CORE_STACK_SERVICES[@]}"
  fi

  stack_compose run --rm --no-deps -T --entrypoint sh db -c \
    'set -eu; find /var/lib/postgresql/data -mindepth 1 -delete; tar -C /var/lib/postgresql -xzf -' \
    <"${backup_dir}/db-data.tar.gz"
  stack_compose run --rm --no-deps -T --entrypoint sh db -c \
    'set -eu; find /etc/postgresql-custom -mindepth 1 -delete; tar -C /etc/postgresql-custom -xzf -' \
    <"${backup_dir}/db-config.tar.gz"

  stack_compose up -d --wait --wait-timeout 180 "${CORE_STACK_SERVICES[@]}"
  if [[ "${app_was_running}" == "true" ]]; then
    app_compose up -d --no-build --wait --wait-timeout 180
  fi
  echo "backup restored: ${backup_dir}"
}

run_db_command() {
  local action="$1"
  local db_url
  db_url="$(resolve_stack_db_url)"
  local command_prefix=()
  if [[ "${db_url}" == *"@127.0.0.1:"* ]]; then
    command_prefix=(env PGSSLMODE=disable)
  fi

  case "${action}" in
    plan)
      "${command_prefix[@]}" pnpm exec supabase db push --dry-run --db-url "${db_url}"
      ;;
    lint)
      "${command_prefix[@]}" pnpm exec supabase db lint --fail-on error --db-url "${db_url}"
      ;;
    migrate)
      "${command_prefix[@]}" pnpm exec supabase db push --yes --db-url "${db_url}"
      ;;
  esac
}

reset_database() {
  local confirmation="${1:-}"
  if [[ "${confirmation}" != "DELETE-ALL-PRODUCTION-DATA" ]]; then
    echo "reset permanently deletes production DB/Auth/Storage data and local production backups" >&2
    echo "rerun with: mise run prod:reset -- --confirm DELETE-ALL-PRODUCTION-DATA" >&2
    exit 1
  fi

  require_commands docker
  require_stack_env

  app_compose down --remove-orphans
  stack_compose down --remove-orphans

  mkdir -p "${STACK_DIR}/volumes/db/data" "${STACK_DIR}/volumes/storage"
  stack_compose run --rm --no-deps -T \
    -v "${STACK_DIR}/volumes/storage:/wipe-storage" \
    --entrypoint sh db -c \
    'set -eu; find /var/lib/postgresql/data -mindepth 1 -delete; find /etc/postgresql-custom -mindepth 1 -delete; find /wipe-storage -mindepth 1 -delete'
  stack_compose down -v --remove-orphans

  if [[ -d "${BACKUP_ROOT}" ]]; then
    find "${BACKUP_ROOT}" -mindepth 1 -delete
  fi

  echo "production DB/Auth/Storage data and local production backups were deleted"
  echo "recovery: mise run prod:supabase:up && mise run prod:db:migrate"
  echo "then bootstrap an administrator before running mise run prod:up"
}

migrate_database() {
  local app_was_running=false

  run_db_command plan
  if app_is_running; then
    app_was_running=true
    app_compose stop
  fi

  create_snapshot
  run_db_command migrate

  if [[ "${app_was_running}" == "true" ]]; then
    app_compose up -d --no-build --wait --wait-timeout 180
  fi
}

case "${1:-}" in
  backup)
    create_snapshot
    ;;
  plan)
    require_commands pnpm
    run_db_command plan
    ;;
  lint)
    require_commands pnpm
    run_db_command lint
    ;;
  migrate)
    require_commands pnpm
    migrate_database
    ;;
  rollback)
    restore_snapshot "${2:-}" "${3:-}"
    ;;
  reset)
    if [[ "${2:-}" != "--confirm" || $# -ne 3 ]]; then
      reset_database ""
    fi
    reset_database "${3:-}"
    ;;
  *)
    echo "usage: bash scripts/prod-db.sh backup|plan|lint|migrate|rollback [backup-dir --confirm]|reset --confirm DELETE-ALL-PRODUCTION-DATA" >&2
    exit 1
    ;;
esac
