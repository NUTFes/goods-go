#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

IMPORT_FILE="${ROOT_DIR}/supabase/data/2026_45th_movement.sql"
CONFIRMATION="IMPORT-2026-MOVEMENT"

import_2026_movement() {
  local admin_email="" confirmation=""

  while (($# > 0)); do
    case "$1" in
      --admin-email)
        admin_email="${2:-}"
        shift 2
        ;;
      --confirm)
        confirmation="${2:-}"
        shift 2
        ;;
      *)
        echo "unknown option: $1" >&2
        exit 1
        ;;
    esac
  done

  if [[ ! "${admin_email}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
    echo "a valid --admin-email is required" >&2
    exit 1
  fi

  if [[ "${confirmation}" != "${CONFIRMATION}" ]]; then
    echo "production data import requires explicit confirmation" >&2
    echo "rerun with: mise run prod:data:import -- --admin-email <email> --confirm ${CONFIRMATION}" >&2
    exit 1
  fi

  require_commands docker
  require_stack_env
  if [[ ! -f "${IMPORT_FILE}" ]]; then
    echo "import file is missing: ${IMPORT_FILE}" >&2
    exit 1
  fi

  stack_compose up -d --wait --wait-timeout 180 "${CORE_STACK_SERVICES[@]}"
  bash "${SCRIPT_DIR}/prod-admin.sh" require
  bash "${SCRIPT_DIR}/prod-db.sh" backup

  stack_compose exec -T \
    -e "PGOPTIONS=-c goods_go.import_admin_email=${admin_email}" \
    db psql \
    -U postgres \
    -d postgres \
    -v ON_ERROR_STOP=1 \
    <"${IMPORT_FILE}"

  echo "2026 movement data import completed"
}

case "${1:-}" in
  import-2026-movement)
    shift
    import_2026_movement "$@"
    ;;
  *)
    echo "usage: bash scripts/prod-data.sh import-2026-movement --admin-email <email> --confirm ${CONFIRMATION}" >&2
    exit 1
    ;;
esac
