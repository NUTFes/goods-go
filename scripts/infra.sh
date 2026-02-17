#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ENV_FILE="${ROOT_DIR}/.env"

STACK_DIR="${ROOT_DIR}/supabase/self-host-stack"
STACK_ENV_FILE="${STACK_DIR}/.env"
STACK_COMPOSE_FILE="${STACK_DIR}/docker-compose.yml"
STACK_COMPOSE_PROJECT="goods-go-supabase-prod"

usage() {
  cat <<'EOF'
usage:
  bash scripts/infra.sh dev up|down|logs [service...]
  bash scripts/infra.sh prod deploy|up|down|logs|status [service...]
  bash scripts/infra.sh supabase up|down|logs|status|plan|lint|migrate|reset [service...]
EOF
}

ensure_commands() {
  local command_name
  for command_name in "$@"; do
    if ! command -v "${command_name}" >/dev/null 2>&1; then
      echo "[infra] missing required command: ${command_name}" >&2
      exit 1
    fi
  done
}

read_env_value() {
  local env_file="$1"
  local variable_name="$2"

  if [[ ! -f "${env_file}" ]]; then
    echo ""
    return
  fi

  local line
  line="$(grep -E "^${variable_name}=" "${env_file}" | tail -n 1 || true)"

  if [[ -z "${line}" ]]; then
    echo ""
    return
  fi

  echo "${line#*=}"
}

read_bool_option() {
  local variable_name="$1"
  local default_value="${2:-false}"

  if [[ -n "${!variable_name:-}" ]]; then
    echo "${!variable_name}"
    return
  fi

  local env_value
  env_value="$(read_env_value "${APP_ENV_FILE}" "${variable_name}")"

  if [[ -n "${env_value}" ]]; then
    echo "${env_value}"
    return
  fi

  echo "${default_value}"
}

ensure_sslmode_disable() {
  local db_url="$1"

  if [[ "${db_url}" == *"sslmode="* ]]; then
    echo "${db_url}"
    return
  fi

  if [[ "${db_url}" == *"?"* ]]; then
    echo "${db_url}&sslmode=disable"
    return
  fi

  echo "${db_url}?sslmode=disable"
}

require_stack_files() {
  if [[ ! -f "${STACK_COMPOSE_FILE}" ]]; then
    echo "[infra] ${STACK_COMPOSE_FILE} is missing" >&2
    exit 1
  fi

  if [[ ! -f "${STACK_ENV_FILE}" ]]; then
    echo "[infra] ${STACK_ENV_FILE} is missing" >&2
    exit 1
  fi
}

ensure_supavisor_ready() {
  if ! is_stack_service_running "supavisor"; then
    stack_compose up -d supavisor
  fi

  wait_for_stack_service_ready "supavisor"
}

resolve_stack_public_url() {
  local public_url
  public_url="$(read_env_value "${STACK_ENV_FILE}" "SUPABASE_PUBLIC_URL")"

  if [[ -z "${public_url}" ]]; then
    public_url="$(read_env_value "${STACK_ENV_FILE}" "API_EXTERNAL_URL")"
  fi

  if [[ -z "${public_url}" ]]; then
    echo "[infra] SUPABASE_PUBLIC_URL or API_EXTERNAL_URL is missing in ${STACK_ENV_FILE}" >&2
    exit 1
  fi

  echo "${public_url}"
}

resolve_stack_publishable_key() {
  local publishable_key
  publishable_key="$(read_env_value "${STACK_ENV_FILE}" "ANON_KEY")"

  if [[ -z "${publishable_key}" ]]; then
    echo "[infra] ANON_KEY is missing in ${STACK_ENV_FILE}" >&2
    exit 1
  fi

  echo "${publishable_key}"
}

resolve_supabase_db_url() {
  if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    echo "${SUPABASE_DB_URL}"
    return
  fi

  local app_env_db_url
  app_env_db_url="$(read_env_value "${APP_ENV_FILE}" "SUPABASE_DB_URL")"
  if [[ -n "${app_env_db_url}" ]]; then
    ensure_sslmode_disable "${app_env_db_url}"
    return
  fi

  local postgres_password
  local postgres_port
  local postgres_db
  local pooler_tenant_id
  local postgres_user

  postgres_password="$(read_env_value "${STACK_ENV_FILE}" "POSTGRES_PASSWORD")"
  postgres_port="$(read_env_value "${STACK_ENV_FILE}" "POSTGRES_PORT")"
  postgres_db="$(read_env_value "${STACK_ENV_FILE}" "POSTGRES_DB")"
  pooler_tenant_id="$(read_env_value "${STACK_ENV_FILE}" "POOLER_TENANT_ID")"

  if [[ -z "${postgres_password}" ]]; then
    echo "[infra] POSTGRES_PASSWORD is missing in ${STACK_ENV_FILE}" >&2
    exit 1
  fi

  if [[ -z "${postgres_port}" ]]; then
    postgres_port="5432"
  fi

  if [[ -z "${postgres_db}" ]]; then
    postgres_db="postgres"
  fi

  postgres_user="postgres"
  if [[ -n "${pooler_tenant_id}" ]]; then
    postgres_user="postgres.${pooler_tenant_id}"
  fi

  ensure_sslmode_disable "postgresql://${postgres_user}:${postgres_password}@127.0.0.1:${postgres_port}/${postgres_db}"
}

is_stack_service_running() {
  local service_name="$1"
  local container_id
  container_id="$(stack_compose ps -q "${service_name}" 2>/dev/null | head -n 1)"

  if [[ -z "${container_id}" ]]; then
    return 1
  fi

  local container_status
  container_status="$(docker inspect -f '{{.State.Status}}' "${container_id}" 2>/dev/null || true)"
  [[ "${container_status}" == "running" ]]
}

wait_for_stack_service_ready() {
  local service_name="$1"
  local timeout_seconds="${2:-90}"
  local start_time
  start_time="$(date +%s)"

  while true; do
    local container_id
    container_id="$(stack_compose ps -q "${service_name}" 2>/dev/null | head -n 1)"

    if [[ -n "${container_id}" ]]; then
      local container_status
      local health_status

      container_status="$(docker inspect -f '{{.State.Status}}' "${container_id}" 2>/dev/null || true)"
      health_status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${container_id}" 2>/dev/null || true)"

      if [[ "${container_status}" == "running" && ("${health_status}" == "healthy" || "${health_status}" == "none") ]]; then
        return
      fi
    fi

    if (( $(date +%s) - start_time >= timeout_seconds )); then
      echo "[infra] timeout waiting for ${service_name} to become ready" >&2
      exit 1
    fi

    sleep 2
  done
}

stack_compose() {
  require_stack_files

  local compose_args=(
    --project-name "${STACK_COMPOSE_PROJECT}"
    --env-file "${STACK_ENV_FILE}"
    -f "${STACK_COMPOSE_FILE}"
  )

  docker compose "${compose_args[@]}" "$@"
}

prod_compose() {
  local compose_args=(-f "${ROOT_DIR}/compose.prod.yml")
  if [[ -f "${APP_ENV_FILE}" ]]; then
    compose_args=(--env-file "${APP_ENV_FILE}" "${compose_args[@]}")
  fi

  local next_public_url
  local next_public_publishable_key

  require_stack_files
  next_public_url="$(resolve_stack_public_url)"
  next_public_publishable_key="$(resolve_stack_publishable_key)"

  NEXT_PUBLIC_SUPABASE_URL="${next_public_url}" \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${next_public_publishable_key}" \
    docker compose "${compose_args[@]}" "$@"
}

dev_compose() {
  local compose_args=(-f "${ROOT_DIR}/compose.dev.yml")
  if [[ -f "${APP_ENV_FILE}" ]]; then
    compose_args=(--env-file "${APP_ENV_FILE}" "${compose_args[@]}")
  fi

  docker compose "${compose_args[@]}" "$@"
}

dev_up() {
  ensure_commands docker pnpm
  dev_compose up -d
  pnpm exec supabase start
}

dev_down() {
  ensure_commands docker pnpm
  pnpm exec supabase stop || true
  dev_compose down
}

dev_logs() {
  ensure_commands docker
  if (( $# == 0 )); then
    dev_compose logs -f --tail 200
    return
  fi

  dev_compose logs -f --tail 200 "$@"
}

supabase_up() {
  ensure_commands docker
  stack_compose up -d
}

supabase_down() {
  ensure_commands docker
  stack_compose down
}

supabase_logs() {
  ensure_commands docker
  if (( $# == 0 )); then
    stack_compose logs -f --tail 200
    return
  fi

  stack_compose logs -f --tail 200 "$@"
}

supabase_migrate() {
  ensure_commands docker pnpm

  ensure_supavisor_ready

  local db_url
  db_url="$(resolve_supabase_db_url)"

  local include_seed
  include_seed="$(read_bool_option "SUPABASE_DB_PUSH_INCLUDE_SEED" "false")"
  if [[ "${include_seed}" == "true" ]]; then
    PGSSLMODE=disable pnpm exec supabase db push --include-seed --db-url "${db_url}"
    return
  fi

  PGSSLMODE=disable pnpm exec supabase db push --db-url "${db_url}"
}

supabase_status() {
  ensure_commands docker pnpm
  stack_compose ps

  ensure_supavisor_ready

  local db_url
  db_url="$(resolve_supabase_db_url)"
  PGSSLMODE=disable pnpm exec supabase migration list --db-url "${db_url}"
}

supabase_plan() {
  ensure_commands docker pnpm

  ensure_supavisor_ready

  local db_url
  db_url="$(resolve_supabase_db_url)"

  local include_seed
  include_seed="$(read_bool_option "SUPABASE_DB_PUSH_INCLUDE_SEED" "false")"
  if [[ "${include_seed}" == "true" ]]; then
    PGSSLMODE=disable pnpm exec supabase db push --dry-run --include-seed --db-url "${db_url}"
    return
  fi

  PGSSLMODE=disable pnpm exec supabase db push --dry-run --db-url "${db_url}"
}

supabase_lint() {
  ensure_commands docker pnpm

  ensure_supavisor_ready

  local db_url
  db_url="$(resolve_supabase_db_url)"
  PGSSLMODE=disable pnpm exec supabase db lint --fail-on error --db-url "${db_url}"
}

supabase_reset() {
  ensure_commands sh

  local reset_script="${STACK_DIR}/reset.sh"
  if [[ ! -f "${reset_script}" ]]; then
    echo "[infra] ${reset_script} is missing" >&2
    exit 1
  fi

  local auto_confirm
  auto_confirm="${INFRA_SUPABASE_RESET_AUTO_CONFIRM:-$(read_env_value "${APP_ENV_FILE}" "INFRA_SUPABASE_RESET_AUTO_CONFIRM")}"

  if [[ "${auto_confirm}" == "true" ]]; then
    (
      cd "${STACK_DIR}"
      sh ./reset.sh -y
    )
    return
  fi

  (
    cd "${STACK_DIR}"
    sh ./reset.sh
  )
}

supabase_update_stack() {
  ensure_commands git docker

  local temp_dir="${ROOT_DIR}/supabase/.temp_update_stack"
  rm -rf "${temp_dir}"
  mkdir -p "${temp_dir}"

  echo "[infra] fetching latest self-host-stack from official supabase repository..."
  
  # Perform sparse checkout
  git clone --filter=blob:none --no-checkout https://github.com/supabase/supabase "${temp_dir}"
  (
    cd "${temp_dir}"
    git sparse-checkout set --cone docker
    git checkout master
  )

  echo "[infra] syncing files to ${STACK_DIR}..."
  mkdir -p "${STACK_DIR}"
  
  # Copy all files including dotfiles (.env.example etc.)
  cp -rf "${temp_dir}/docker/." "${STACK_DIR}/"
  
  # Ensure .env exists for stack_compose commands
  if [[ ! -f "${STACK_DIR}/.env" ]]; then
    echo "[infra] creating .env from .env.example..."
    cp "${STACK_DIR}/.env.example" "${STACK_DIR}/.env"
  fi
  
  # Clean up
  rm -rf "${temp_dir}"

  echo "[infra] pulling latest docker images..."
  stack_compose pull

  echo "[infra] update stack completed."
  echo "[infra] please check ${STACK_DIR}/CHANGELOG.md for any breaking changes."
}

prod_up() {
  ensure_commands docker
  prod_compose up -d --build
}

prod_down() {
  ensure_commands docker
  prod_compose down
}

prod_logs() {
  ensure_commands docker
  if (( $# == 0 )); then
    prod_compose logs -f --tail 200
    return
  fi

  prod_compose logs -f --tail 200 "$@"
}

prod_status() {
  ensure_commands docker
  prod_compose ps
}

prod_deploy() {
  supabase_up

  local skip_migrate
  skip_migrate="${INFRA_PROD_SKIP_DB_MIGRATE:-$(read_env_value "${APP_ENV_FILE}" "INFRA_PROD_SKIP_DB_MIGRATE")}"

  if [[ "${skip_migrate}" != "true" ]]; then
    supabase_migrate
  else
    echo "[infra] skip DB migration (INFRA_PROD_SKIP_DB_MIGRATE=true)"
  fi

  prod_up
  echo "[infra] deploy completed"
}

if (( $# < 2 )); then
  usage
  exit 1
fi

scope="$1"
action="$2"
shift 2

case "${scope}" in
  dev)
    case "${action}" in
      up) dev_up ;;
      down) dev_down ;;
      logs) dev_logs "$@" ;;
      *) usage; exit 1 ;;
    esac
    ;;
  prod)
    case "${action}" in
      deploy) prod_deploy ;;
      up) prod_up ;;
      down) prod_down ;;
      logs) prod_logs "$@" ;;
      status) prod_status ;;
      *) usage; exit 1 ;;
    esac
    ;;
  supabase)
    case "${action}" in
      up) supabase_up ;;
      down) supabase_down ;;
      logs) supabase_logs "$@" ;;
      status) supabase_status ;;
      plan) supabase_plan ;;
      lint) supabase_lint ;;
      migrate) supabase_migrate ;;
      reset) supabase_reset ;;
      update-stack) supabase_update_stack ;;
      *) usage; exit 1 ;;
    esac
    ;;
  *)
    usage
    exit 1
    ;;
esac
