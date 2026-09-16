#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

IMPORT_FILE="${ROOT_DIR}/supabase/data/2026_45th_movement.sql"
CONFIRMATION="IMPORT-2026-MOVEMENT"

import_2026_movement() {
  local confirmation="${1:-}"

  if [[ "${confirmation}" != "${CONFIRMATION}" ]]; then
    echo "production data import requires explicit confirmation" >&2
    echo "rerun with: mise run prod:data:import -- --confirm ${CONFIRMATION}" >&2
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

  stack_compose exec -T db psql \
    -U postgres \
    -d postgres \
    -v ON_ERROR_STOP=1 \
    <"${IMPORT_FILE}"

  echo "2026 movement data import completed"
}

case "${1:-}" in
  import-2026-movement)
    if [[ "${2:-}" != "--confirm" || $# -ne 3 ]]; then
      import_2026_movement ""
    fi
    import_2026_movement "${3:-}"
    ;;
  *)
    echo "usage: bash scripts/prod-data.sh import-2026-movement --confirm ${CONFIRMATION}" >&2
    exit 1
    ;;
esac
