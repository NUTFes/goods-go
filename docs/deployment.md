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

| サーバー名 | URL                                |
| ---------- | ---------------------------------- |
| pve01      | https://proxmox-pve01.nutmeg.cloud |
| pve02      | https://proxmox-pve02.nutmeg.cloud |
| pve03      | https://proxmox-pve03.nutmeg.cloud |

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

| 項目       | 最小要件         | 推奨             |
| ---------- | ---------------- | ---------------- |
| CPU        | 2 コア           | 4 コア           |
| メモリ     | 4 GB             | 8 GB             |
| ストレージ | 20 GB            | 40 GB            |
| OS         | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

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
     - Disk size: 24 GB
   - **CPU**:
     - Cores: 4
   - **Memory**:
     - Memory: 4096 MB
     - Swap: 0 MB
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

### 2. Dockerのaptリポジトリの追加

```bash
# Add Docker's official GPG key:
sudo apt update
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
sudo tee /etc/apt/sources.list.d/docker.sources << EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
```

### 3. Docker のインストール

```bash
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 4. mise のインストール

```bash
sudo apt update -y && sudo apt install -y curl
sudo install -dm 755 /etc/apt/keyrings
curl -fSs https://mise.jdx.dev/gpg-key.pub | sudo tee /etc/apt/keyrings/mise-archive-keyring.asc 1> /dev/null
echo "deb [signed-by=/etc/apt/keyrings/mise-archive-keyring.asc] https://mise.jdx.dev/deb stable main" | sudo tee /etc/apt/sources.list.d/mise.list
sudo apt update -y
sudo apt install -y mise
```

### 5. プロジェクトのクローン

```bash
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

### 1. 秘密情報の生成と適用（初回セットアップ）

初回セットアップ時に、本番用のパスワードやJWTシークレットを自動生成して適用します。
（スタック一式が存在しない場合は、自動的に公式からダウンロードされます）

```bash
cd goods-go
mise run prod:setup --domain goods-go. < your-domain > --apply
```

このコマンドは以下を実行します:

- Supabase 公式構成のダウンロード (存在しない場合)
- `.env` の自動化された生成
- 安全なランダムパスワードと JWT トークンの自動生成・適用
- 運用ドメインに基づく各種設定値 (`SUPABASE_PUBLIC_URL`, `SITE_URL` など) の自動適用

> **Warning**: もし後から `POSTGRES_PASSWORD` を変更した場合、コンテナの再起動だけでは新しいパスワードのデータベースは初期化されません（古いパスワードの情報が残るため）。その場合は下記のフルリセットコマンド（`mise run prod:hard-reset`）が必要です。

### 2. Supabase の起動

```bash
cd goods-go
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
cd goods-go
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
4. Tunnel 名を入力（例: `goods-go`）
5. **Cloudflared** を選択して **Next**
6. 表示されたトークンをコピー

### 2. Tunnel トークンの設定

`.env` ファイルにトークンを設定:

```dotenv
TUNNEL_TOKEN=<コピーしたトークン>
```

### 3. Public Hostname の設定

Cloudflare ダッシュボードでデプロイした各サービスへの Private Network / Docker ネットワーク経由でのルーティング（Public Hostname）を設定します。
`setup-prod-env.sh` 出力時に表示された 3つの Public Hostname を順番に登録します。

#### ① アプリケーション (Next.js)

| 項目         | 値                  |
| ------------ | ------------------- |
| Subdomain    | `goods-go`          |
| Domain       | `nutfes.net` （例） |
| Service Type | HTTP                |
| URL          | `app:3000`          |

#### ② Supabase API (Kong)

| 項目         | 値                   |
| ------------ | -------------------- |
| Subdomain    | `goods-go-api`       |
| Domain       | `nutfes.net` （例）  |
| Service Type | HTTP                 |
| URL          | `supabase-kong:8000` |

#### ③ Supabase Studio

| 項目         | 値                     |
| ------------ | ---------------------- |
| Subdomain    | `goods-go-studio`      |
| Domain       | `nutfes.net` （例）    |
| Service Type | HTTP                   |
| URL          | `supabase-studio:3000` |

> **Note**: Service Type と URL はコンテナ間の内部通信を使用するため、上記の内容で正確に指定してください。

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

データベースの物理ファイル（実データ）を含む全てのデータを削除してやり直す場合:

```bash
# 本番環境のコンテナと実データを根本から削除（sudo使用）
mise run prod:hard-reset

# 再デプロイ
mise run prod:deploy
```

> **Warning**: `prod:hard-reset` はデータベースの物理ファイルを含む全てのデータを不可逆的に削除します。本番環境では実行に十分注意してください。

---

## 運用コマンド一覧

| 操作                    | コマンド                                |
| ----------------------- | --------------------------------------- |
| 初回セットアップ        | `mise run prod:setup --domain <DOMAIN>` |
| 一括デプロイ            | `mise run prod:deploy`                  |
| アプリ起動              | `mise run prod:up`                      |
| アプリ停止              | `mise run prod:down`                    |
| アプリログ              | `mise run prod:logs`                    |
| アプリ状態              | `mise run prod:status`                  |
| Supabase 更新           | `mise run supabase:update-stack`        |
| Supabase 起動           | `mise run prod:supabase:up`             |
| Supabase 停止           | `mise run prod:supabase:down`           |
| Supabase ログ           | `mise run prod:supabase:logs`           |
| Supabase 状態           | `mise run prod:supabase:status`         |
| DB マイグレーション     | `mise run prod:supabase:migrate`        |
| DB マイグレーション確認 | `mise run prod:supabase:plan`           |
| DB Lint                 | `mise run prod:supabase:lint`           |
| 通常リセット            | `mise run prod:supabase:reset`          |
| 物理フルリセット        | `mise run prod:hard-reset`              |

---

## 関連ドキュメント

- [README.md](../README.md) - プロジェクト概要と開発環境
- [Supabase Self-Hosting Guide](https://supabase.com/docs/guides/self-hosting)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Proxmox VE Documentation](https://pve.proxmox.com/pve-docs/)
