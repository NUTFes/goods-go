#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "${ROOT_DIR}/scripts/prod-stack.sh" sync
bash "${ROOT_DIR}/scripts/prod-stack.sh" up
bash "${ROOT_DIR}/scripts/prod-db.sh" migrate
bash "${ROOT_DIR}/scripts/prod-app.sh" up

echo "production deploy completed"

