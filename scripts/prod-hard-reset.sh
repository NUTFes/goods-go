#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Hard Reset - Production Environment"
echo ""
echo "WARNING: All database and storage contents will be completely deleted."
echo "NOTE: You may be prompted for your sudo password during execution."
echo ""
read -p "Are you sure you want to proceed? (y/N): " answer
if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
  echo "Canceled."
  exit 0
fi

echo "[1/3] Stopping and removing containers..."
bash "${ROOT_DIR}/scripts/infra.sh" prod down
bash "${ROOT_DIR}/scripts/infra.sh" supabase down

echo "[2/3] Physically deleting mounted volume data..."
VOLUMES_DIR="${ROOT_DIR}/supabase/self-host-stack/volumes"

if [[ -d "${VOLUMES_DIR}/db/data" ]]; then
  sudo rm -rf "${VOLUMES_DIR}/db/data"
  echo "  -> Deleted: ${VOLUMES_DIR}/db/data"
fi

if [[ -d "${VOLUMES_DIR}/storage" ]]; then
  sudo rm -rf "${VOLUMES_DIR}/storage"
  echo "  -> Deleted: ${VOLUMES_DIR}/storage"
fi

echo "[3/3] Complete"
echo "To deploy again, please run:"
echo "  mise run prod:deploy"
