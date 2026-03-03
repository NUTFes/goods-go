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

## ローカル開発環境の構築

### 1. 依存関係のインストール

miseが自動的にNode.jsとpnpmのバージョンを管理します。

```bash
mise trust
mise install
pnpm install
```

### 2. 環境変数（アプリ側 `.env`）の準備

[NUTFes/settings](https://github.com/NUTFes/settings/tree/main/goods-go/) の値をベースに作成してください。local Supabase を使う場合の最小値は以下です。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

### 3. アプリとローカルDBの起動

```bash
mise run up
```

---

## 本番環境 (Self-hosted) の構築手順

本番運用では `supabase/self-host-stack/` 以下の Docker Compose 構成を利用します。

### 1. 秘密情報の生成と適用

初回セットアップ時に、本番用のパスワードやJWTシークレットを自動生成して適用します。
（スタック一式が存在しない場合は、自動的に公式からダウンロードされます）

```bash
# 本番環境のセットアップと秘密情報の生成・適用 (対象のドメインを指定)
mise run prod:setup --domain goods-go.nutfes.net --apply
```

> **Warning**
> 後から `.env` 内の `POSTGRES_PASSWORD` を変更した場合、DBコンテナを立ち上げ直すだけでは反映されません（古いパスワードで初期化されたデータが残るため）。その場合は下記の「フルリセット（`mise run prod:hard-reset`）」手順を実行してください。

### 2. 本番環境へのデプロイ

```bash
# 一括デプロイ（DB起動・Migration適用・アプリ起動をすべて実行）
mise run prod:deploy
```

## 認証運用ポリシー（現行）

- メールサーバー（SMTP）は運用しません。
- パスワードリセット機能は提供しません（`forgot-password` / `update-password` ルートは未使用）。
- アカウント復旧が必要な場合は、管理者によるアカウント削除後に再登録で対応します。
- Supabase Auth はメール確認不要（`[auth.email].enable_confirmations = false`）で運用します。

## コマンド一覧

### 開発（App + Local Supabase）

| 操作             | コマンド         | 説明                           |
| :--------------- | :--------------- | :----------------------------- |
| **起動**         | `mise run up`    | アプリと Supabase Local を起動 |
| **停止**         | `mise run down`  | 開発環境の停止                 |
| **ログ**         | `mise run logs`  | 開発環境のログを表示           |
| **再ビルド起動** | `mise run build` | 開発環境をビルドして起動       |

### Supabase Local (CLI)

| 操作              | コマンド                                    | 説明                                |
| :---------------- | :------------------------------------------ | :---------------------------------- |
| **起動**          | `mise run supabase:start`                   | Local Supabase の起動               |
| **停止**          | `mise run supabase:stop`                    | Local Supabase の停止               |
| **接続情報**      | `mise run supabase:status`                  | Local Supabase の接続情報を確認     |
| **リセット**      | `mise run supabase:reset`                   | Migration + Seed を再適用して初期化 |
| **Lint**          | `mise run supabase:lint`                    | スキーマのLintチェック              |
| **型生成**        | `mise run supabase:typegen`                 | DBからTypeScriptの型を生成          |
| **Migration作成** | `mise run supabase:migration:new -- <name>` | 新規 Migration ファイルの作成       |

### Supabase Production (Self-hosted)

| 操作             | コマンド                         | 説明                                   |
| :--------------- | :------------------------------- | :------------------------------------- |
| **更新**         | `mise run supabase:update-stack` | 公式からスタックを最新化               |
| **起動**         | `mise run prod:supabase:up`      | Self-hosted Supabase を起動            |
| **停止**         | `mise run prod:supabase:down`    | Self-hosted Supabase を停止            |
| **ログ**         | `mise run prod:supabase:logs`    | Self-hosted Supabase のログを表示      |
| **状態**         | `mise run prod:supabase:status`  | Self-hosted Supabase の状態を確認      |
| **Dry-run**      | `mise run prod:supabase:plan`    | 本番DBへの Migration 差分を確認        |
| **Lint**         | `mise run prod:supabase:lint`    | 本番DBのスキーマLintチェック           |
| **適用**         | `mise run prod:supabase:migrate` | 本番DBへ Migration を適用              |
| **フルリセット** | `mise run prod:supabase:reset`   | コンテナと \`.env\` などを通常リセット |

### App Production

| 操作             | コマンド                                | 説明                                         |
| :--------------- | :-------------------------------------- | :------------------------------------------- |
| **セットアップ** | `mise run prod:setup --domain <DOMAIN>` | 本番環境の初回構築と秘密情報生成             |
| **一括デプロイ** | `mise run prod:deploy`                  | DB反映込みで本番環境を一気にデプロイ（推奨） |
| **起動**         | `mise run prod:up`                      | 本番アプリのみを起動                         |
| **停止**         | `mise run prod:down`                    | 本番アプリのみを停止                         |
| **ログ**         | `mise run prod:logs`                    | 本番アプリ環境のログを表示                   |
| **状態**         | `mise run prod:status`                  | 本番アプリ環境の状態を確認                   |
| **物理リセット** | `mise run prod:hard-reset`              | 実データも完全に削除する強力なリセット       |

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

`mise run prod:supabase:reset` はコンテナ・ボリューム・`.env` を含む通常の初期化を行いますが、データベース（PostgreSQL）の物理ファイルが `root` 権限で作成されているため、完全に削除しきれずデータが残る場合があります。

**⚠️ パスワード設定などを失敗し、DBが立ち上がらなくなった場合**
強力な「完全リセット」用のコマンド（コンテナ停止 + 内部で `sudo rm -rf` を実行）を用意しています。

```bash
# 本番環境のコンテナと実データを根本から削除します
mise run prod:hard-reset

# その後、一括デプロイで再起動します
mise run prod:deploy
```

## 補足

- `mise run prod:*` 実行時、`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` は self-host 側 `.env` から自動注入されます
- `SUPABASE_DB_URL` を root `.env`（または環境変数）に設定すると、prod migration の接続先を上書きできます
- `SUPABASE_DB_PUSH_INCLUDE_SEED=true` で prod migration 時に `supabase/seed.sql` を同時適用できます
- `INFRA_PROD_SKIP_APP_BUILD=true` を指定すると、`mise run prod:up` / `mise run prod:deploy` の app build を省略して高速化できます（既存イメージを再利用）
