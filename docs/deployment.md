# goods-go デプロイ手順書

本ドキュメントでは、Proxmox VE 上の LXC コンテナまたは VM を使用した goods-go のデプロイ手順を説明します。

## 目次

1. [前提条件](#前提条件)
2. [Proxmox VE へのアクセス](#proxmox-ve-へのアクセス)
3. [LXC / VM の作成](#lxc--vm-の作成)
4. [サーバー環境のセットアップ](#サーバー環境のセットアップ)
5. [Supabase セルフホスティング](#supabase-セルフホスティング)
6. [アプリケーションのデプロイ](#アプリケーションのデプロイ)
7. [Cloudflare Tunnel の設定](#cloudflare-tunnel-の設定)
8. [動作確認](#動作確認)
9. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

### 必要な権限・アカウント

- GitHub アカウント（NUTFes 組織に所属）
- Cloudflare Access 経由での Proxmox VE アクセス権限
- Cloudflare Tunnel 用のトークン

### 技術要件

- Docker / Docker Compose
- Git
- mise（タスクランナー/バージョン管理）

---

## Proxmox VE へのアクセス

NUTFes では、Proxmox VE サーバーを使用して LXC コンテナや VM を管理しています。

### サーバー一覧

| サーバー名 | URL |
|-----------|-----|
| pve01 | https://proxmox-pve01.nutmeg.cloud |
| pve02 | https://proxmox-pve02.nutmeg.cloud |
| pve03 | https://proxmox-pve03.nutmeg.cloud |

### Cloudflare Access によるログイン

1. 上記の URL にアクセスします
2. Cloudflare Access の認証画面が表示されます
3. **「Sign in with GitHub」** を選択します
4. GitHub アカウントで認証を行います
5. 認証後、Proxmox VE の WebUI にアクセスできます

> **Note**: NUTFes 組織のメンバーであることが認証の前提条件です。

---

## LXC / VM の作成

### 推奨スペック

| 項目 | 最小要件 | 推奨 |
|------|---------|------|
| CPU | 2 コア | 4 コア |
| メモリ | 4 GB | 8 GB |
| ストレージ | 30 GB | 50 GB |
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

### LXC コンテナの作成手順

1. Proxmox VE WebUI にログイン
2. 対象ノードを選択（pve01, pve02, pve03 のいずれか）
3. 右上の **「Create CT」** をクリック
4. 以下の設定を入力:
   - **General**:
     - CT ID: 適当な番号（例: 200）
     - Hostname: `goods-go-prod`
     - Password: 安全なパスワードを設定
   - **Template**:
     - Template: `ubuntu-24.04-standard_24.04-2_amd64.tar.zst`
   - **Disks**:
     - Storage: local-lvm
     - Disk size: 50 GB
   - **CPU**:
     - Cores: 4
   - **Memory**:
     - Memory: 8192 MB
     - Swap: 1024 MB
   - **Network**:
     - IPv4: DHCP または静的 IP を設定
5. **「Finish」** をクリックして作成

### VM の作成手順（代替）

VM を使用する場合は、通常の手順で Ubuntu 24.04 LTS をインストールしてください。LXC の方がリソース効率が良いため、特別な理由がない限り LXC を推奨します。

---

## サーバー環境のセットアップ

LXC / VM が起動したら、SSH またはコンソールで接続し、以下の手順で環境を構築します。

### 1. システムの更新

```bash
apt update && apt upgrade -y
```

### 2. Docker のインストール

```bash
# 必要なパッケージのインストール
apt install -y ca-certificates curl gnupg

# Docker の公式 GPG キーを追加
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Docker リポジトリを追加
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker のインストール
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Docker の起動確認
docker --version
docker compose version
```

### 3. Git のインストール

```bash
apt install -y git
```

### 4. mise のインストール

```bash
curl https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
source ~/.bashrc
mise --version
```

### 5. プロジェクトのクローン

```bash
# プロジェクトディレクトリの作成
mkdir -p /opt/apps
cd /opt/apps

# リポジトリをクローン
git clone https://github.com/NUTFes/goods-go.git
cd goods-go

# mise の設定を信頼
mise trust
mise install
```

---

## Supabase セルフホスティング

goods-go では、本番環境に Supabase のセルフホスティングを使用します。

### 1. Supabase スタックの取得

初回セットアップ時、または最新版へのアップデート時に実行します:

```bash
cd /opt/apps/goods-go
mise run supabase:update-stack
```

このコマンドは以下を実行します:
- Supabase 公式リポジトリから最新の Docker 構成を取得
- `supabase/self-host-stack/` ディレクトリに展開
- `.env.example` から `.env` を作成（存在しない場合）
- Docker イメージを pull

### 2. Supabase 環境変数の設定

`supabase/self-host-stack/.env` を編集し、以下の値を必ず変更してください:

```bash
cd /opt/apps/goods-go/supabase/self-host-stack
nano .env
```

#### 必須の変更項目

```dotenv
# --- 重要なセキュリティ設定 ---

# PostgreSQL のパスワード（必ず変更）
POSTGRES_PASSWORD=<強力なパスワード>

# JWT シークレット（32文字以上のランダムな文字列）
JWT_SECRET=<ランダムな文字列>

# Anon / Service Role キー
# 以下のコマンドで生成可能:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ANON_KEY=<生成した anon キー>
SERVICE_ROLE_KEY=<生成した service role キー>

# Dashboard の認証情報
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<強力なパスワード>

# --- 公開 URL 設定 ---
# ※ <your-domain> は実際のドメインに置き換えてください

# アプリケーションからアクセス可能な Supabase の URL
# Cloudflare Tunnel を使う場合は公開ドメインを指定
SUPABASE_PUBLIC_URL=https://supabase.goods-go.<your-domain>
API_EXTERNAL_URL=https://supabase.goods-go.<your-domain>

# --- サイト URL 設定 ---

# アプリケーションの URL（認証コールバック等で使用）
SITE_URL=https://goods-go.<your-domain>
```

> **Warning**: `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` は本番環境では必ず新しい値を生成してください。デフォルト値のままでは重大なセキュリティリスクとなります。

#### JWT キーの生成方法

```bash
# JWT_SECRET の生成（32文字以上）
openssl rand -base64 32

# ANON_KEY / SERVICE_ROLE_KEY の生成
# Supabase 公式の jwt-generator を使用することを推奨
# https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
```

### 3. Supabase の起動

```bash
cd /opt/apps/goods-go
mise run prod:supabase:up
```

### 4. 起動確認

```bash
mise run prod:supabase:status
```

全てのコンテナが `running` 状態であることを確認します。

### 5. データベースマイグレーションの実行

```bash
# マイグレーションの差分確認（dry-run）
mise run prod:supabase:plan

# マイグレーションの適用
mise run prod:supabase:migrate
```

---

## アプリケーションのデプロイ

### 1. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成します:

```bash
cd /opt/apps/goods-go
cp .env.example .env
nano .env
```

以下の値を設定:

```dotenv
# Supabase 接続情報
# self-host 側の .env から自動注入されるため、通常は設定不要
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Cloudflare Tunnel トークン
TUNNEL_TOKEN=<Cloudflare Tunnel のトークン>
```

> **Note**: `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` は、`mise run prod:*` コマンド実行時に `supabase/self-host-stack/.env` から自動的に読み込まれます。

### 2. 一括デプロイ（推奨）

以下のコマンドで Supabase + アプリケーションを一括でデプロイできます:

```bash
mise run prod:deploy
```

このコマンドは以下を実行します:
1. Supabase セルフホストスタックの起動
2. データベースマイグレーションの適用
3. アプリケーションのビルドと起動

### 3. 個別デプロイ

個別に操作する場合は以下のコマンドを使用:

```bash
# Supabase の起動
mise run prod:supabase:up

# マイグレーション適用
mise run prod:supabase:migrate

# アプリケーションの起動
mise run prod:up
```

### 4. デプロイ確認

```bash
# アプリケーションの状態確認
mise run prod:status

# ログの確認
mise run prod:logs
```

---

## Cloudflare Tunnel の設定

goods-go では、Cloudflare Tunnel を使用してアプリケーションを公開します。

### 1. Cloudflare Tunnel の作成

1. [Cloudflare Zero Trust ダッシュボード](https://one.dash.cloudflare.com/) にアクセス
2. **Networks** > **Tunnels** を選択
3. **Create a tunnel** をクリック
4. Tunnel 名を入力（例: `goods-go-prod`）
5. **Cloudflared** を選択して **Next**
6. 表示されたトークンをコピー

### 2. Tunnel トークンの設定

`.env` ファイルにトークンを設定:

```dotenv
TUNNEL_TOKEN=<コピーしたトークン>
```

### 3. Public Hostname の設定

Cloudflare ダッシュボードで Public Hostname を設定:

> **Note**: 以下の `<your-domain>` は組織の実際のドメインに置き換えてください。

| 項目 | 値 |
|------|-----|
| Subdomain | `goods-go` |
| Domain | `<your-domain>` |
| Service Type | HTTP |
| URL | `app:3000` |

> **Note**: Service URL の `app` は、`compose.prod.yml` で定義されているサービス名です。

### 4. Supabase 用の Public Hostname（オプション）

Supabase API を外部からアクセス可能にする場合は、追加の Public Hostname を設定:

| 項目 | 値 |
|------|-----|
| Subdomain | `supabase.goods-go` |
| Domain | `<your-domain>` |
| Service Type | HTTP |
| URL | `host.docker.internal:8000` |

---

## 動作確認

### 1. コンテナの状態確認

```bash
# Supabase コンテナ
mise run prod:supabase:status

# アプリケーションコンテナ
mise run prod:status
```

### 2. ログの確認

```bash
# Supabase のログ
mise run prod:supabase:logs

# アプリケーションのログ
mise run prod:logs
```

### 3. ブラウザでのアクセス確認

Cloudflare Tunnel で設定したドメインにアクセスし、アプリケーションが正常に表示されることを確認します。

---

## トラブルシューティング

### Docker コンテナが起動しない

```bash
# コンテナの状態を確認
docker ps -a

# 特定のコンテナのログを確認
docker logs <container_id>

# Docker サービスの再起動
systemctl restart docker
```

### Supabase に接続できない

```bash
# Supabase コンテナの状態を確認
mise run prod:supabase:status

# supavisor（接続プール）の状態を確認
docker logs goods-go-supabase-prod-supavisor-1

# PostgreSQL への直接接続テスト
docker exec -it goods-go-supabase-prod-db-1 psql -U postgres
```

### マイグレーションが失敗する

```bash
# dry-run でエラー内容を確認
mise run prod:supabase:plan

# データベーススキーマの Lint
mise run prod:supabase:lint
```

### Cloudflare Tunnel が接続しない

```bash
# cloudflared コンテナのログを確認
docker logs goods-go-tunnel

# トンネルトークンが正しく設定されているか確認
cat .env | grep TUNNEL_TOKEN
```

### フルリセット（最終手段）

全てのデータを削除してやり直す場合:

```bash
# Supabase スタックのフルリセット
mise run prod:supabase:reset

# アプリケーションの停止と再デプロイ
mise run prod:down
mise run prod:deploy
```

> **Warning**: `prod:supabase:reset` は全てのデータを削除します。本番環境では十分注意してください。

---

## 運用コマンド一覧

| 操作 | コマンド |
|------|---------|
| 一括デプロイ | `mise run prod:deploy` |
| アプリ起動 | `mise run prod:up` |
| アプリ停止 | `mise run prod:down` |
| アプリログ | `mise run prod:logs` |
| アプリ状態 | `mise run prod:status` |
| Supabase 起動 | `mise run prod:supabase:up` |
| Supabase 停止 | `mise run prod:supabase:down` |
| Supabase ログ | `mise run prod:supabase:logs` |
| Supabase 状態 | `mise run prod:supabase:status` |
| DB マイグレーション | `mise run prod:supabase:migrate` |
| DB マイグレーション確認 | `mise run prod:supabase:plan` |
| DB Lint | `mise run prod:supabase:lint` |
| フルリセット | `mise run prod:supabase:reset` |

---

## 関連ドキュメント

- [README.md](../README.md) - プロジェクト概要と開発環境
- [Supabase Self-Hosting Guide](https://supabase.com/docs/guides/self-hosting)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Proxmox VE Documentation](https://pve.proxmox.com/pve-docs/)
