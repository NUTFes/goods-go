# goods-go デプロイ手順書

本ドキュメントでは、Proxmox VE 上の LXC コンテナまたは VM を使用した goods-go のデプロイ手順を説明します。

## 前提

- Ubuntu 24.04 LTS などのサポート対象 Linux
- Docker Engine と Docker Compose plugin
- Git
- mise
- 4 CPU、8 GB RAM、40 GB 以上の永続 storage を推奨
- 外部へ保存される定期 backup

Self-hosted Supabase では OS 更新、監視、backup、災害復旧、可用性は運用者の責任です。詳細は [Supabase self-hosting responsibilities](https://supabase.com/docs/guides/self-hosting) を参照してください。

## 初期セットアップ

```bash
git clone https://github.com/NUTFes/goods-go.git
cd goods-go
mise trust
mise install
pnpm install --frozen-lockfile
```

### Cloudflare Tunnel token

token は環境変数や Compose command line に置かず、Docker Compose secret の入力 file に保存します。`cloudflared` の `--token-file` は 2025.4.0 以降で公式にサポートされています。

```bash
install -d -m 700 secrets
read -rsp 'Cloudflare Tunnel token: ' TUNNEL_TOKEN
printf '%s' "$TUNNEL_TOKEN" > secrets/cloudflare-tunnel-token
unset TUNNEL_TOKEN
chmod 644 secrets/cloudflare-tunnel-token
```

必要なら `.env.example` を `.env` にコピーし、token file path や外部 DB URL override を設定します。

```bash
cp .env.example .env
chmod 600 .env
```

### Supabase secrets

```bash
mise run prod:setup -- --domain goods-go.example.com
```

API domain は既定で `goods-go-api.example.com` になります。変更する場合:

```bash
mise run prod:setup -- \
  --domain goods-go.example.com \
  --api-domain api.goods-go.example.com
```

この処理は次を行います。

1. 固定 commit の公式 `docker/` directory を `supabase/self-host-stack/docker/` に同期
2. 公式 utility で legacy key と asymmetric key を生成
3. production URL を設定
4. `.env` を mode `0600` で保存

生成 secret は stdout に出力しません。既存 `.env` がある場合は停止します。`--force` は PostgreSQL data がまだ作成されていない初期セットアップのやり直しに限られ、既存 DB の credential rotation には使用できません。

### 初期 Admin

本番の初期 Admin だけを Supabase Auth Admin API と private database function で明示的に作成します。

password を command line や shell history に残さないよう mode `0600` の file を作成します。password は app の入力制約に合わせて 8 文字以上の半角英数字にします。

```bash
install -m 600 /dev/null secrets/admin-password
read -rsp 'Initial admin password: ' ADMIN_PASSWORD
printf '%s' "$ADMIN_PASSWORD" > secrets/admin-password
unset ADMIN_PASSWORD

mise run prod:supabase:up
mise run prod:db:migrate
mise run prod:admin:bootstrap -- \
  --email admin@example.com \
  --password-file ./secrets/admin-password
mise run prod:admin:check
```

command は Kong の `127.0.0.1` bind から Admin API を呼び、secret key と password を出力しません。同じ Admin email での再実行は成功扱いですが、active Admin が存在する状態で別ユーザーへ置換する操作は拒否します。初期化後は password file を password manager へ移し、server 上から安全に削除してください。

## Cloudflare Tunnel route

Cloudflare Zero Trust で次の 2 hostname だけを登録します。

| hostname   | service            |
| ---------- | ------------------ |
| app domain | `http://app:3000`  |
| API domain | `http://kong:8000` |

Supabase Studio hostname は登録しません。Studio、postgres-meta、Realtime、Storage、Edge Functions は既定では起動しません。

## Deploy

```bash
mise run prod:deploy
```

初回だけは前節の Admin bootstrap を先に完了してください。`prod:deploy` と `prod:up` は active Admin が存在しない場合に app 起動を拒否します。Supabase core は bootstrap に必要なため Admin 不在でも起動できます。

処理順:

1. 固定 Supabase checkout を検証・同期
2. core services (`db`, `auth`, `rest`, `kong`, `supavisor`) を health 待機付きで起動
3. migration dry-run
4. PostgreSQL data directory と pgsodium key の停止 snapshot
5. migration 適用
6. app image build、app health 待機、Cloudflare Tunnel 起動

本番 app の `/api/health` は app process だけでなく private Docker network 上の Supabase Auth health も 3 秒 timeout で確認します。Cloudflare Tunnel は app が healthy になってから起動します。
app または tunnel が ready にならない場合、Compose 起動は 180 秒で失敗し、無期限には待機しません。

```bash
mise run prod:supabase:status
mise run prod:status
mise run prod:supabase:logs
mise run prod:logs
```

## Network と公開 port

Supabase core、app、cloudflared は固定 private network `goods-go-prod` を共有します。

- Kong: 管理 command 用に `127.0.0.1:8000` のみ bind。外部 interface へは公開しない
- Supabase Studio:起動しない、host port を公開しない
- Supavisor session port: `127.0.0.1:5432` のみに bind
- app: host port を公開せず Cloudflare Tunnel からのみ到達
- cloudflared: outbound connection のみ

Docker Compose の network 内では `app` と `kong` の service name で名前解決します。公式資料は [Compose networking](https://docs.docker.com/compose/how-tos/networking/) を参照してください。

## Migration

```bash
mise run prod:db:plan
mise run prod:db:lint
mise run prod:db:migrate
```

`prod:db:migrate` は dry-run と backup が成功しない限り migration を適用しません。production で `supabase migration down` を自動 rollback として使用しません。任意の DDL を安全に逆変換できないためです。

seed は local development 専用です。本番 migration に `supabase/seed.sql` は自動適用しません。

## Backup と rollback

```bash
mise run prod:db:backup
```

backup は整合性を優先した停止 snapshot です。app と core services を一時停止し、以下を `backups/prod/<UTC timestamp>/` に保存します。

- PostgreSQL data directory
- pgsodium root key を含む `db-config` volume
- app/Supabase commit metadata
- SHA-256 checksum

同一 host 上の snapshot だけでは災害復旧になりません。作成後に暗号化した off-host storage へ転送し、保持世代と復元試験を運用してください。Storage は無効ですが、将来有効にする場合は object file を DB と別に backup する必要があります。

rollback:

```bash
mise run prod:db:rollback -- backups/prod/20260613T000000Z --confirm
```

path を省略すると `backups/prod/latest` を使用できますが、事故防止のため本番では timestamp directory を明示してください。restore は checksum を検証し、現在の DB data と pgsodium key を置換して core services を再起動します。

物理 snapshot は作成時と同じ `supabase/self-hosted.version` pin でのみ復元できます。script は metadata の commit が現在の pin と一致しない restore を拒否します。

## 全データ reset

次の command は production app/core を停止し、PostgreSQL、Auth、将来または過去に作成された Storage object、`db-config` named volume、`backups/prod` の local snapshot を復元不能な形で削除します。Supabase `.env` の secret、domain 設定、固定 self-host checkout は再構築用に残します。off-host backup はこの command の対象外です。

確認文字列が完全一致しない限り何も削除しません。

```bash
mise run prod:reset -- --confirm DELETE-ALL-PRODUCTION-DATA
```

clean state から再開する手順:

```bash
mise run prod:supabase:up
mise run prod:db:migrate
mise run prod:admin:bootstrap -- \
  --email admin@example.com \
  --password-file ./secrets/admin-password
mise run prod:up
```

secret も交換する場合は reset 後に既存 stack `.env` を別途安全に廃棄し、`mise run prod:setup -- --domain ... --force` で生成し直します。これは tunnel token や external secret manager 内の値を自動更新しません。

## Stack update

1. [Supabase changelog](https://supabase.com/changelog) と checkout 内 `docker/CHANGELOG.md` を確認
2. breaking change、PostgreSQL major、image version、`.env.example` 差分を review
3. `mise run prod:db:backup` を実行し off-host copy を確認
4. [supabase/self-hosted.version](../supabase/self-hosted.version) を reviewed commit SHA へ変更
5. staging で以下を実行

```bash
mise run prod:supabase:sync
mise run prod:supabase:config
mise run prod:supabase:pull
mise run prod:db:plan
```

6. staging restore test と health check 後に production maintenance window で deploy

`master`、tag name、短縮 SHA は設定できません。script は 40 文字 SHA 以外を拒否します。

## Studio と log viewer

Supabase Studio は production default から外しています。DB 管理は migration、`psql`、Supabase CLI を使用し、管理 UI を public API domain に同居させません。

## CI と手動確認

CI は次を検証します。

- format、lint、typecheck、Next.js build
- shell syntax
- dev/prod Compose render
- self-host commit pin
- `latest` image と Docker socket mount が production app Compose にないこと
- local Supabase migration reset、schema lint、generated type 一致

手動 smoke test:

```bash
curl --fail https://goods-go.example.com/api/health
curl --fail https://goods-go-api.example.com/auth/v1/health
```

## 公式資料

- [Self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Auth Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Docker Compose startup order and healthchecks](https://docs.docker.com/compose/how-tos/startup-order/)
- [Docker Compose merge/reset/override](https://docs.docker.com/reference/compose-file/merge/)
- [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
- [Cloudflare Tunnel token-file](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/)
- [Dozzle security considerations](https://dozzle.dev/guide/authentication)
