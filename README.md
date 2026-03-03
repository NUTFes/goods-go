# goods-go

Next.js + Supabase の開発環境

## 技術スタック

- Next.js 16 (App Router)
- React 19
- Supabase (Local + Self-hosted)
- Docker Compose
- mise (タスクランナー/バージョン管理)
- pnpm
- Biome (Linter/Formatter)
- Tailwind CSS v4

## 前提条件

- Docker / Docker Compose
- mise

### mise のインストール

miseを導入していない場合は、以下のコマンドでインストールしてください。

```bash
curl https://mise.run | sh
```

詳細は公式ドキュメントを参照: <https://mise.jdx.dev/installing-mise.html>

## 開発を始める

### 1. 依存関係のインストール

miseが自動的にNode.jsとpnpmのバージョンを管理します。

```bash
mise trust
mise install
pnpm install
```

## 環境変数

### 1) アプリ側 `.env`

[NUTFes/settings](https://github.com/NUTFes/settings/tree/main/goods-go/) の値をベースに作成してください。local Supabase を使う場合の最小値は以下です。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

### 2) self-host 側 `supabase/self-host-stack/.env`

初回セットアップ時に、本番用のパスワードやJWTシークレットを自動生成して適用します。

```bash
# ① 公式のDockerファイルを引っ張ってくる
mise run supabase:update-stack

# ② 秘密情報の生成と適用 (対象のドメインを指定)
bash scripts/setup-prod-env.sh --domain goods-go.nutfes.net --apply
```

> **Warning**
> 後から `POSTGRES_PASSWORD` を変更した場合、DBコンテナを立ち上げ直すだけでは反映されません（古いパスワードで初期化されたデータが残るため）。その場合は下記の「フルリセット」手順を実行してください。

## 認証運用ポリシー（現行）

- メールサーバー（SMTP）は運用しません。
- パスワードリセット機能は提供しません（`forgot-password` / `update-password` ルートは未使用）。
- アカウント復旧が必要な場合は、管理者によるアカウント削除後に再登録で対応します。
- Supabase Auth はメール確認不要（`[auth.email].enable_confirmations = false`）で運用します。

## コマンド一覧

### 開発（App + Local Supabase）

- **起動**: `mise run up`
  - アプリと Supabase Local を起動します。
- **停止**: `mise run down`
- **ログ**: `mise run logs`
- **再ビルド起動**: `mise run build`

### Supabase Local (CLI)

- **起動**: `mise run supabase:start`
- **停止**: `mise run supabase:stop`
- **接続情報**: `mise run supabase:status`
- **リセット**: `mise run supabase:reset`
  - Migration + Seed 再適用
- **Lint**: `mise run supabase:lint`
- **型生成**: `mise run supabase:typegen`
- **Migration 作成**: `mise run supabase:migration:new -- <name>`

### Supabase Production (Self-hosted)

- **起動**: `mise run prod:supabase:up`
- **停止**: `mise run prod:supabase:down`
- **ログ**: `mise run prod:supabase:logs`
- **状態**: `mise run prod:supabase:status`
- **Migration dry-run**: `mise run prod:supabase:plan`
- **Lint**: `mise run prod:supabase:lint`
- **Migration 適用**: `mise run prod:supabase:migrate`
- **フルリセット**: `mise run prod:supabase:reset`

### App Production

- **起動**: `mise run prod:up`
- **停止**: `mise run prod:down`
- **ログ**: `mise run prod:logs`
- **状態**: `mise run prod:status`
- **一括デプロイ（推奨）**: `mise run prod:deploy`

## 実行可否テスト手順

### A. dev（Local CLI）

```bash
mise run up
mise run supabase:status
mise run supabase:reset
mise run supabase:lint
mise run supabase:typegen
mise run down
```

### B. prod（Self-host）

```bash
mise run prod:supabase:up
mise run prod:supabase:status
mise run prod:supabase:plan
mise run prod:supabase:lint
mise run prod:supabase:migrate
mise run prod:up
mise run prod:status
mise run prod:down
mise run prod:supabase:down
```

## フルリセット

`mise run prod:supabase:reset` は `supabase/self-host-stack/docker/reset.sh` を実行し、コンテナ・ボリューム・`.env` を含む初期化を行います。

**⚠️ 注意: パスワードを変更した場合の完全リセット**
DBのパスワード（`POSTGRES_PASSWORD`）を変更した際など、認証エラー（`FATAL 28P01 (invalid_password)`）が消えない場合は、ホスト側にマウントされている実データを物理的に削除する必要があります。

```bash
# 1. コンテナを完全停止
mise run prod:supabase:down
docker compose -f compose.prod.yml down

# 2. 実データを物理削除（重要！）
ROOT_DIR="$(pwd)"
if [[ ! -d "${ROOT_DIR}/supabase/self-host-stack/volumes" ]]; then
  echo "supabase volume path not found: ${ROOT_DIR}/supabase/self-host-stack/volumes" >&2
  exit 1
fi
sudo rm -rf "${ROOT_DIR}/supabase/self-host-stack/volumes/db/data"
sudo rm -rf "${ROOT_DIR}/supabase/self-host-stack/volumes/storage"

# 3. 再デプロイ
mise run prod:deploy
```

## 補足

- `mise run prod:*` 実行時、`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` は self-host 側 `.env` から自動注入されます
- `SUPABASE_DB_URL` を root `.env`（または環境変数）に設定すると、prod migration の接続先を上書きできます
- `SUPABASE_DB_PUSH_INCLUDE_SEED=true` で prod migration 時に `supabase/seed.sql` を同時適用できます
- `INFRA_PROD_SKIP_APP_BUILD=true` を指定すると、`mise run prod:up` / `mise run prod:deploy` の app build を省略して高速化できます（既存イメージを再利用）
