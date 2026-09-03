#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_ENV_FILE="${ROOT_DIR}/.env.dev.generated"
DEV_COMPOSE_FILE="${ROOT_DIR}/compose.dev.yml"

require_commands() {
  local command_name
  for command_name in "$@"; do
    command -v "${command_name}" >/dev/null 2>&1 || {
      echo "missing required command: ${command_name}" >&2
      exit 1
    }
  done
}

write_app_env() {
  local status_output api_url publishable_key
  status_output="$(pnpm exec supabase status -o env 2>/dev/null)"
  api_url="$(printf '%s\n' "${status_output}" | sed -n 's/^API_URL="\(.*\)"$/\1/p')"
  publishable_key="$(printf '%s\n' "${status_output}" | sed -n 's/^PUBLISHABLE_KEY="\(.*\)"$/\1/p')"

  if [[ -z "${publishable_key}" ]]; then
    publishable_key="$(printf '%s\n' "${status_output}" | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
  fi

  if [[ -z "${api_url}" || -z "${publishable_key}" ]]; then
    echo "failed to read local Supabase connection details" >&2
    exit 1
  fi

  umask 077
  {
    printf 'NEXT_PUBLIC_SUPABASE_URL=%s\n' "${api_url}"
    printf 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=%s\n' "${publishable_key}"
  } >"${DEV_ENV_FILE}"
}

dev_compose() {
  docker compose --env-file "${DEV_ENV_FILE}" -f "${DEV_COMPOSE_FILE}" "$@"
}

supabase_up() {
  pnpm exec supabase start >/dev/null
  write_app_env
}

case "${1:-}" in
  up)
    require_commands docker pnpm
    supabase_up
    dev_compose up -d --build --wait --wait-timeout 180
    ;;
  down)
    require_commands docker pnpm
    if [[ -f "${DEV_ENV_FILE}" ]]; then
      dev_compose down
    fi
    pnpm exec supabase stop --project-id goods-go || true
    rm -f "${DEV_ENV_FILE}"
    ;;
  logs)
    require_commands docker
    dev_compose logs -f --tail 200 "${@:2}"
    ;;
  status)
    require_commands docker pnpm
    pnpm exec supabase status
    if [[ -f "${DEV_ENV_FILE}" ]]; then
      dev_compose ps
    fi
    ;;
  supabase-up)
    require_commands docker pnpm
    supabase_up
    ;;
  *)
    echo "usage: bash scripts/dev.sh up|down|logs|status|supabase-up" >&2
    exit 1
    ;;
esac
