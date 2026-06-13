#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

case "${1:-}" in
  up)
    require_commands docker
    bash "${SCRIPT_DIR}/prod-admin.sh" require
    app_compose up -d --build --wait --wait-timeout 180
    ;;
  start)
    require_commands docker
    bash "${SCRIPT_DIR}/prod-admin.sh" require
    app_compose up -d --no-build --wait --wait-timeout 180
    ;;
  stop)
    require_commands docker
    app_compose stop
    ;;
  down)
    require_commands docker
    app_compose down
    ;;
  logs)
    require_commands docker
    shift
    app_compose logs -f --tail 200 "$@"
    ;;
  status)
    require_commands docker
    app_compose ps
    ;;
  config)
    require_commands docker
    app_compose config --quiet
    ;;
  *)
    echo "usage: bash scripts/prod-app.sh up|start|stop|down|logs|status|config" >&2
    exit 1
    ;;
esac
