# goods-go

Next.js + self-hosted Supabase の開発環境

## 技術スタック

- Next.js 16 (App Router)
- Supabase (self-hosted)
- Docker Compose
- mise (タスクランナー/バージョン管理)
- pnpm
- Biome (Linter/Formatter)

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

### 2. 環境変数の設定

Supabaseの環境変数ファイル (`supabase/.env`) が必要です。

[NUTFes/settings](https://github.com/NUTFes/settings/tree/main/goods-go/supabase) から取得してください。

### 3. 開発環境の起動

```bash
mise run up
```

このコマンドでSupabaseとNext.jsの開発環境がDockerで起動します。
<http://localhost:3000> でアプリケーションにアクセスできます。

開発環境では `src/` と `public/` がボリュームマウントされているため、
コードの変更は自動的にホットリロードされます。

### 4. 環境の停止

```bash
mise run down
```

## ビルドが必要なケース

通常の開発では `mise run up` だけで良いですが、以下の場合は再ビルドが必要です。

```bash
mise run 07-docker:build
```

- `package.json` の依存関係を変更した場合 (パッケージの追加/削除/更新)
- `Dockerfile` を変更した場合
- `next.config.ts` を変更した場合
- その他ビルド時に反映される設定ファイルを変更した場合

## 利用可能なタスク

`mise tasks` で一覧を確認できます。`mise run`で選択したタスクを実行できます。

| タスク              | エイリアス       | 説明                              |
| ------------------- | ---------------- | --------------------------------- |
| `01-up`             | `up`             | 開発環境起動 (Supabase + Next.js) |
| `02-down`           | `down`           | 全環境停止 (Dev/Prod/Supabase)    |
| `03-lint`           | `lint`           | Lintチェック                      |
| `04-lint:fix`       | `lint:fix`       | Lint修正                          |
| `05-format:check`   | `format:check`   | フォーマット確認                  |
| `06-format`         | `format`         | フォーマット適用                  |
| `07-docker:build`   | `docker:build`   | 開発環境をビルドして起動          |
| `08-prod:up`        | `prod:up`        | 本番環境を起動                    |
| `09-prod:build`     | `prod:build`     | 本番環境をビルドして起動          |
| `10-prod:down`      | `prod:down`      | 本番環境を停止 (Supabase含む)     |
| `11-supabase:reset` | `supabase:reset` | Supabase DBリセット               |
| `12-clean`          | `clean`          | ビルド成果物を削除                |
| `13-clean:docker`   | `clean:docker`   | Dockerリソースを削除              |

## ディレクトリ構成

```bash
.
├── src/             # アプリケーションソースコード
├── public/          # 静的ファイル
├── supabase/        # Supabase self-hosted 設定
├── compose.dev.yml  # 開発用 Docker Compose
├── compose.prod.yml # 本番用 Docker Compose
├── dev.Dockerfile   # 開発用 Dockerfile
├── prod.Dockerfile  # 本番用 Dockerfile
└── .mise.toml       # mise 設定 (タスク/ツールバージョン)
```
