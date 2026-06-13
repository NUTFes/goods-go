#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

sync_stack() {
  require_commands git
  load_stack_version
  local new_checkout=false

  if [[ ! -d "${STACK_REPO_DIR}/.git" ]]; then
    if [[ -e "${STACK_REPO_DIR}" ]]; then
      echo "${STACK_REPO_DIR} exists but is not a Git checkout" >&2
      exit 1
    fi
    git clone --filter=blob:none --no-checkout "${SUPABASE_UPSTREAM_REPOSITORY}" "${STACK_REPO_DIR}"
    git -C "${STACK_REPO_DIR}" sparse-checkout set --cone docker
    new_checkout=true
  fi

  if [[ "${new_checkout}" == "false" && -n "$(git -C "${STACK_REPO_DIR}" status --porcelain --untracked-files=no -- docker)" ]]; then
    echo "tracked upstream files under ${STACK_DIR} were modified; review or restore them before syncing" >&2
    exit 1
  fi

  git -C "${STACK_REPO_DIR}" fetch --depth 1 origin "${SUPABASE_UPSTREAM_REF}"
  git -C "${STACK_REPO_DIR}" checkout --detach "${SUPABASE_UPSTREAM_REF}"
  git -C "${STACK_REPO_DIR}" sparse-checkout set --cone docker

  local actual_ref
  actual_ref="$(git -C "${STACK_REPO_DIR}" rev-parse HEAD)"
  if [[ "${actual_ref}" != "${SUPABASE_UPSTREAM_REF}" ]]; then
    echo "self-host checkout mismatch: expected ${SUPABASE_UPSTREAM_REF}, got ${actual_ref}" >&2
    exit 1
  fi

  echo "Supabase self-host stack synced to ${actual_ref}"
}

case "${1:-}" in
  sync)
    sync_stack
    ;;
  up)
    require_commands docker
    stack_compose up -d --wait --wait-timeout 180 "${CORE_STACK_SERVICES[@]}"
    ;;
  down)
    require_commands docker
    stack_compose down
    ;;
  logs)
    require_commands docker
    shift
    if (($# == 0)); then
      stack_compose logs -f --tail 200 "${CORE_STACK_SERVICES[@]}"
    else
      stack_compose logs -f --tail 200 "$@"
    fi
    ;;
  status)
    require_commands docker
    stack_compose ps "${CORE_STACK_SERVICES[@]}"
    ;;
  pull)
    require_commands docker
    stack_compose pull "${CORE_STACK_SERVICES[@]}"
    ;;
  config)
    require_commands docker
    stack_compose config --quiet
    ;;
  *)
    echo "usage: bash scripts/prod-stack.sh sync|up|down|logs|status|pull|config" >&2
    exit 1
    ;;
esac
