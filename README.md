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

`mise run prod:supabase:reset` は `supabase/self-host-stack/docker/reset.sh` を実行し、
コンテナ・ボリューム・`.env` を含む初期化を行います。

- 通常は確認プロンプトが表示されます
- CI等で無人実行する場合のみ `INFRA_SUPABASE_RESET_AUTO_CONFIRM=true` を指定してください

## 補足

- `mise run prod:*` 実行時、`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` は self-host 側 `.env` から自動注入されます
- `SUPABASE_DB_URL` を root `.env`（または環境変数）に設定すると、prod migration の接続先を上書きできます
- `SUPABASE_DB_PUSH_INCLUDE_SEED=true` で prod migration 時に `supabase/seed.sql` を同時適用できます

## Dozzle アラート連携 (Slack)

Dozzle v10 では強力なアラートシステムが導入され、特定の条件を満たすコンテナログに対して通知を送信することができます。
以下に、SlackのIncoming Webhookを利用した連携手順と、新規アラート対象の追加方法を記載します。

※ アラートと通知先の設定は Dozzle 内の `/data` ディレクトリに保存されるため、Dockerコンテナの再起動時に設定を保持するにはボリュームマウントが必要です。

### 1. Slack での Incoming Webhook 設定

まず、Slack側で通知を受け取るためのWebhook URLを発行します。

1. Slackのワークスペースで「App」または「インテグレーション」の管理画面を開きます。
2. **Incoming Webhooks** アプリを検索してワークスペースに追加します。
3. 通知を送りたいチャンネルを選択し、「Incoming Webhook インテグレーションの追加」をクリックします。
4. 発行された **Webhook URL** をコピーして控えておきます。

### 2. Dozzle への通知先 (Destination) 登録

次に、取得したWebhook URLをDozzleに登録します。

1. Dozzleの管理画面を開き、**Notifications**（通知）ページに移動します。
2. **Add Destination**（通知先の追加）をクリックします。
3. 種類として **Webhook** を選択し、先ほど控えた Slack の Webhook URL を入力します。
4. DozzleにはSlack向けの組み込みペイロードテンプレートが用意されているため、Slack用のフォーマット（Blocks および Markdown 対応）を選択できます。
5. 保存する前に **Test** ボタンをクリックし、Slackにテスト通知が届くか確認します。
6. 問題なければ設定を保存します。

### 3. 新規アラート対象の追加（アラートルールの作成）

通知先を設定したら、どのようなログが流れたときに通知するか（アラートルール）を設定します。
Dozzleのアラートは以下の2つのフィルターの組み合わせで動作します：

- **Container filter**（コンテナフィルター）: どのコンテナを監視対象にするか
- **Log filter**（ログフィルター）: どのようなログメッセージが出力されたときにアラートをトリガーするか

#### アラートルールの設定手順：

1. Dozzleの管理画面から **Alerts**（アラート）ページに移動し、**New Alert**（新規アラート作成）をクリックします。
2. **Container filter** を設定します。（例: 特定の名前のコンテナのみ、または全てのコンテナ）
3. **Log filter** を設定します。特定のエラー文字列（例: `error`、`Exception` など）を正規表現やテキスト一致で指定します。
4. ログが両方のフィルターに一致した場合に、登録済みの通知先（Slack）へ通知が送信されます。

#### 通知ペイロードで利用可能な変数（参考）

独自のペイロードテンプレートを作成する場合、以下の変数を使用して柔軟な通知メッセージを構成できます：

- `{{.Container.Name}}` : コンテナ名
- `{{.Container.Image}}` : コンテナイメージ
- `{{.Container.State}}` : コンテナの状態
- `{{.Log.Message}}` : ログメッセージ本文
- `{{.Log.Level}}` : ログレベル
- `{{.Log.Timestamp}}` : ログのタイムスタンプ
- `{{.Subscription.Name}}` : アラートルール名
