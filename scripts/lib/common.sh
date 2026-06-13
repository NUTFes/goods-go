#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STACK_REPO_DIR="${ROOT_DIR}/supabase/self-host-stack"
STACK_DIR="${STACK_REPO_DIR}/docker"
STACK_ENV_FILE="${STACK_DIR}/.env"
STACK_COMPOSE_FILE="${STACK_DIR}/docker-compose.yml"
STACK_OVERRIDE_FILE="${ROOT_DIR}/supabase/compose.prod.yml"
STACK_VERSION_FILE="${ROOT_DIR}/supabase/self-hosted.version"
STACK_COMPOSE_PROJECT="goods-go-supabase-prod"
PROD_NETWORK="goods-go-prod"
APP_ENV_FILE="${ROOT_DIR}/.env"
APP_COMPOSE_FILE="${ROOT_DIR}/compose.prod.yml"
CORE_STACK_SERVICES=(db auth rest kong supavisor)

require_commands() {
  local command_name
  for command_name in "$@"; do
    if ! command -v "${command_name}" >/dev/null 2>&1; then
      echo "missing required command: ${command_name}" >&2
      exit 1
    fi
  done
}

read_env_value() {
  local env_file="$1"
  local variable_name="$2"

  if [[ ! -f "${env_file}" ]]; then
    return 0
  fi

  awk -v key="${variable_name}" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
    }
    END {
      gsub(/^['\''"]|['\''"]$/, "", value)
      print value
    }
  ' "${env_file}"
}

set_env_value() {
  local env_file="$1"
  local variable_name="$2"
  local variable_value="$3"
  local temp_file

  temp_file="$(mktemp "${env_file}.XXXXXX")"
  awk -v key="${variable_name}" -v value="${variable_value}" '
    BEGIN { replaced = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      replaced = 1
      next
    }
    { print }
    END {
      if (!replaced) {
        print key "=" value
      }
    }
  ' "${env_file}" >"${temp_file}"
  chmod 600 "${temp_file}"
  mv "${temp_file}" "${env_file}"
}

require_stack_checkout() {
  if [[ ! -f "${STACK_COMPOSE_FILE}" ]]; then
    echo "production Supabase stack is missing; run 'mise run prod:supabase:sync'" >&2
    exit 1
  fi
}

require_stack_env() {
  require_stack_checkout
  if [[ ! -f "${STACK_ENV_FILE}" ]]; then
    echo "${STACK_ENV_FILE} is missing; run 'mise run prod:setup -- --domain <domain>'" >&2
    exit 1
  fi
}

load_stack_version() {
  if [[ ! -f "${STACK_VERSION_FILE}" ]]; then
    echo "${STACK_VERSION_FILE} is missing" >&2
    exit 1
  fi

  # This tracked file contains only the upstream repository URL and immutable commit.
  # shellcheck source=/dev/null
  source "${STACK_VERSION_FILE}"

  if [[ ! "${SUPABASE_UPSTREAM_REF:-}" =~ ^[0-9a-f]{40}$ ]]; then
    echo "SUPABASE_UPSTREAM_REF must be a full 40-character commit SHA" >&2
    exit 1
  fi
}

stack_compose() {
  require_stack_env
  docker compose \
    --project-name "${STACK_COMPOSE_PROJECT}" \
    --env-file "${STACK_ENV_FILE}" \
    -f "${STACK_COMPOSE_FILE}" \
    -f "${STACK_OVERRIDE_FILE}" \
    "$@"
}

resolve_stack_public_url() {
  local value
  value="$(read_env_value "${STACK_ENV_FILE}" "SUPABASE_PUBLIC_URL")"
  if [[ -z "${value}" ]]; then
    value="$(read_env_value "${STACK_ENV_FILE}" "API_EXTERNAL_URL")"
  fi
  if [[ -z "${value}" ]]; then
    echo "SUPABASE_PUBLIC_URL is missing in ${STACK_ENV_FILE}" >&2
    exit 1
  fi
  printf '%s\n' "${value}"
}

resolve_stack_publishable_key() {
  local value
  value="$(read_env_value "${STACK_ENV_FILE}" "SUPABASE_PUBLISHABLE_KEY")"
  if [[ -z "${value}" ]]; then
    value="$(read_env_value "${STACK_ENV_FILE}" "ANON_KEY")"
  fi
  if [[ -z "${value}" ]]; then
    echo "SUPABASE_PUBLISHABLE_KEY is missing in ${STACK_ENV_FILE}" >&2
    exit 1
  fi
  printf '%s\n' "${value}"
}

resolve_stack_db_url() {
  local override_url
  override_url="${SUPABASE_DB_URL:-$(read_env_value "${APP_ENV_FILE}" "SUPABASE_DB_URL")}"
  if [[ -n "${override_url}" ]]; then
    printf '%s\n' "${override_url}"
    return
  fi

  local password port database tenant
  password="$(read_env_value "${STACK_ENV_FILE}" "POSTGRES_PASSWORD")"
  port="$(read_env_value "${STACK_ENV_FILE}" "POSTGRES_PORT")"
  database="$(read_env_value "${STACK_ENV_FILE}" "POSTGRES_DB")"
  tenant="$(read_env_value "${STACK_ENV_FILE}" "POOLER_TENANT_ID")"

  if [[ -z "${password}" || -z "${tenant}" ]]; then
    echo "POSTGRES_PASSWORD or POOLER_TENANT_ID is missing in ${STACK_ENV_FILE}" >&2
    exit 1
  fi

  printf 'postgresql://postgres.%s:%s@127.0.0.1:%s/%s?sslmode=disable\n' \
    "${tenant}" "${password}" "${port:-5432}" "${database:-postgres}"
}

app_compose() {
  require_stack_env

  local compose_args=(-f "${APP_COMPOSE_FILE}")
  if [[ -f "${APP_ENV_FILE}" ]]; then
    compose_args=(--env-file "${APP_ENV_FILE}" "${compose_args[@]}")
  fi

  NEXT_PUBLIC_SUPABASE_URL="$(resolve_stack_public_url)" \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(resolve_stack_publishable_key)" \
    docker compose "${compose_args[@]}" "$@"
}

