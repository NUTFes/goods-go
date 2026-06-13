#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

active_admin_count() {
  stack_compose exec -T db psql -U postgres -d postgres -Atc \
    "select count(*) from public.users where role = 0 and deleted is null"
}

target_is_active_admin() {
  local email="$1"
  stack_compose exec -T db psql -U postgres -d postgres -At \
    -v ON_ERROR_STOP=1 \
    --set=admin_email="${email}" <<'SQL'
select count(*)
from public.users
where role = 0
  and deleted is null
  and lower(btrim(email)) = lower(btrim(:'admin_email'));
SQL
}

require_admin() {
  local count
  count="$(active_admin_count)"
  if [[ ! "${count}" =~ ^[1-9][0-9]*$ ]]; then
    echo "no active production administrator exists" >&2
    echo "run: mise run prod:admin:bootstrap -- --email <email> --password-file <mode-0600-file>" >&2
    exit 1
  fi
}

validate_password_file() {
  local password_file="$1" permissions
  if [[ ! -f "${password_file}" || -L "${password_file}" ]]; then
    echo "password file must be a regular, non-symlink file: ${password_file}" >&2
    exit 1
  fi

  permissions="$(stat -c '%a' "${password_file}")"
  if ((8#${permissions} & 8#077)); then
    echo "password file must not be accessible by group or others: ${password_file}" >&2
    exit 1
  fi
}

bootstrap_admin() {
  local email="" password_file="" count service_key api_port

  while (($# > 0)); do
    case "$1" in
      --email)
        email="${2:-}"
        shift 2
        ;;
      --password-file)
        password_file="${2:-}"
        shift 2
        ;;
      *)
        echo "unknown option: $1" >&2
        exit 1
        ;;
    esac
  done

  if [[ ! "${email}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ || -z "${password_file}" ]]; then
    echo "usage: bash scripts/prod-admin.sh bootstrap --email <email> --password-file <mode-0600-file>" >&2
    exit 1
  fi

  require_commands docker node stat
  require_stack_env
  stack_compose up -d --wait --wait-timeout 180 "${CORE_STACK_SERVICES[@]}"

  count="$(active_admin_count)"
  if [[ "${count}" =~ ^[1-9][0-9]*$ ]]; then
    if [[ "$(target_is_active_admin "${email}")" == "1" ]]; then
      echo "production administrator already bootstrapped: ${email}"
      return
    fi
    echo "an active production administrator already exists; refusing to replace it" >&2
    exit 1
  fi

  validate_password_file "${password_file}"
  service_key="$(read_env_value "${STACK_ENV_FILE}" "SUPABASE_SECRET_KEY")"
  if [[ -z "${service_key}" ]]; then
    service_key="$(read_env_value "${STACK_ENV_FILE}" "SERVICE_ROLE_KEY")"
  fi
  if [[ -z "${service_key}" ]]; then
    echo "SUPABASE_SECRET_KEY or SERVICE_ROLE_KEY is missing in ${STACK_ENV_FILE}" >&2
    exit 1
  fi
  api_port="$(read_env_value "${STACK_ENV_FILE}" "KONG_HTTP_PORT")"

  SUPABASE_URL="http://127.0.0.1:${api_port:-8000}" \
    SUPABASE_SECRET_KEY="${service_key}" \
    node "${SCRIPT_DIR}/prod-bootstrap-admin.mjs" "${email}" "${password_file}"

  stack_compose exec -T db psql -U postgres -d postgres \
    -v ON_ERROR_STOP=1 \
    --set=admin_email="${email}" <<'SQL'
select private.bootstrap_admin(:'admin_email');
SQL

  require_admin
  echo "production administrator bootstrapped: ${email}"
}

case "${1:-}" in
  bootstrap)
    shift
    bootstrap_admin "$@"
    ;;
  require)
    require_commands docker
    require_admin
    ;;
  *)
    echo "usage: bash scripts/prod-admin.sh bootstrap --email <email> --password-file <file> | require" >&2
    exit 1
    ;;
esac
