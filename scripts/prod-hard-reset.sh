#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "============================================"
echo "*** 本番環境の完全リセット (Hard Reset) ***"
echo "============================================"
echo "※ 注意: データベース、ストレージの中身がすべて消去されます。"
echo "※ 実行中に sudo パスワードを求められる場合があります。"
echo ""
read -p "本当に実行しますか？ (y/N): " answer
if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
  echo "キャンセルしました。"
  exit 0
fi

echo "[1/3] コンテナの停止と削除..."
bash "${ROOT_DIR}/scripts/infra.sh" prod down
bash "${ROOT_DIR}/scripts/infra.sh" supabase down

echo "[2/3] マウントされたボリュームデータの物理削除..."
VOLUMES_DIR="${ROOT_DIR}/supabase/self-host-stack/volumes"

if [[ -d "${VOLUMES_DIR}/db/data" ]]; then
  sudo rm -rf "${VOLUMES_DIR}/db/data"
  echo "  -> Deleted: ${VOLUMES_DIR}/db/data"
fi

if [[ -d "${VOLUMES_DIR}/storage" ]]; then
  sudo rm -rf "${VOLUMES_DIR}/storage"
  echo "  -> Deleted: ${VOLUMES_DIR}/storage"
fi

echo "[3/3] 完了"
echo "デプロイを再実行するには以下を実行してください。"
echo "  mise run prod:deploy"
