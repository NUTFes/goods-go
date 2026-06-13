# goods-go

Next.js 16 + Supabase の物品管理アプリケーションです。

開発と本番の Supabase は分離しています。

- 開発: Supabase CLI local development stack
- 本番: 公式 self-hosted Docker stack

## 必要環境

- Docker Engine / Docker Compose
- [mise](https://mise.jdx.dev/)
- Git

Node.js、pnpm、Supabase CLI はリポジトリでバージョンを固定しています。

```bash
mise trust
mise install
pnpm install --frozen-lockfile
```

## 開発

```bash
mise run dev
```

この 1 コマンドで次を行います。

1. Supabase CLI local stack を起動
2. app container を CLI 管理 network `supabase_network_goods-go` に参加
3. local の URL と publishable key を `.env.dev.generated` に生成
4. Next.js app container を build/start
5. `/api/health` が healthy になるまで待機

アクセス先は `http://127.0.0.1:3000` です。ブラウザは `http://127.0.0.1:54321`、app container は Docker DNS の `http://kong:8000` を使用します。Supabase Studio は `http://127.0.0.1:54323` です。

local seed にはログイン可能な次の確認用ユーザーが含まれます。

| role   | email                   | password   |
| ------ | ----------------------- | ---------- |
| Admin  | `admin@goods-go.local`  | `gidaifes` |
| Leader | `leader@goods-go.local` | `gidaifes` |
| User   | `user@goods-go.local`   | `gidaifes` |

コードベースで使用している Supabase runtime 機能は Auth と PostgREST です。Studio は local migration/schema 確認用に起動しますが、Realtime、Storage、Edge Functions、Inbucket は既定で無効です。

Supabase CLI は local port が `0.0.0.0` に bind される security notice を表示します。Studio を含め認証なしの開発用 service があるため、この構成は firewall が有効な開発端末だけで使用し、共有 server や internet へ直接公開しないでください。local key は本番で使用できません。

```bash
mise run status
mise run logs
mise run supabase:reset
mise run supabase:lint
mise run supabase:typegen
mise run down
```

## 品質確認

```bash
mise run fmt:check
mise run lint
mise run typecheck
mise run build
```

## 本番

本番手順は [docs/deployment.md](docs/deployment.md) を参照してください。概要は次の通りです。

```bash
mise run prod:setup -- --domain goods-go.example.com
mise run prod:supabase:up
mise run prod:db:migrate
mise run prod:admin:bootstrap -- --email admin@example.com --password-file ./secrets/admin-password
mise run prod:deploy
```

本番 app は active Admin が 1 人もいない場合、起動を拒否します。public signup の先着ユーザーを Admin にはしません。

本番 self-host stack は [supabase/self-hosted.version](supabase/self-hosted.version) の完全な commit SHA に固定しています。`master` や latest commit を起動時に追従しません。

既定で起動する Supabase service は以下だけです。

- PostgreSQL
- Auth
- PostgREST
- Kong
- Supavisor

Studio、Realtime、Storage、Edge Functions、Analytics、Vector は起動しません。Studio の public hostname も作成しません。

## mise task

```bash
mise tasks
```

主要 task:

| 用途                           | task                                                  |
| ------------------------------ | ----------------------------------------------------- |
| dev 起動 / 停止                | `dev`, `down`                                         |
| dev 状態 / ログ                | `status`, `logs`                                      |
| local DB reset / lint / 型生成 | `supabase:reset`, `supabase:lint`, `supabase:typegen` |
| 本番初期化                     | `prod:setup`                                          |
| 固定 self-host stack 同期      | `prod:supabase:sync`                                  |
| 本番 Supabase 起動 / 停止      | `prod:supabase:up`, `prod:supabase:down`              |
| 本番 migration dry-run         | `prod:db:plan`                                        |
| 本番 backup / migrate          | `prod:db:backup`, `prod:db:migrate`                   |
| 本番 rollback                  | `prod:db:rollback`                                    |
| 本番初期 Admin                 | `prod:admin:bootstrap`, `prod:admin:check`            |
| 本番全データ削除               | `prod:reset`                                          |
| 本番 deploy                    | `prod:deploy`                                         |

## 公式資料

- [Supabase CLI local development](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase Auth Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Supabase backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Docker Compose networking](https://docs.docker.com/compose/how-tos/networking/)
- [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
