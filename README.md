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

自動で作成されます。

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

`mise run prod:supabase:reset` は `supabase/self-host-stack/docker/reset.sh` を実行し、
コンテナ・ボリューム・`.env` を含む初期化を行います。

- 通常は確認プロンプトが表示されます
- CI等で無人実行する場合のみ `INFRA_SUPABASE_RESET_AUTO_CONFIRM=true` を指定してください

## 補足

- `mise run prod:*` 実行時、`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` は self-host 側 `.env` から自動注入されます
- `SUPABASE_DB_URL` を root `.env`（または環境変数）に設定すると、prod migration の接続先を上書きできます
- `SUPABASE_DB_PUSH_INCLUDE_SEED=true` で prod migration 時に `supabase/seed.sql` を同時適用できます
