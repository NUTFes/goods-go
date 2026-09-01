# 画像変換Spikeの実機確認

Issue #102の開発専用ページで、Browser標準APIとHEICデコーダ候補によるWebP変換を確認する。

JPEG／PNG／WebPはBrowser標準APIを使用する。HEIC／HEIFは標準APIを先に試し、失敗した場合だけ比較対象のHEIC decoderを遅延読み込みする。

## PCで確認する

```bash
mise run dev
```

次を開く。

```text
http://localhost:3000/dev/image-conversion
```

## iPhone／Androidで確認する

`crypto.subtle.digest`などのWeb APIはSecure Contextを必要とする。LAN内の`http://<PCのIP>:3000`では正しい検証にならないため、HTTPSを提供するTailscale Serveを使用する。

PCと端末を同じTailnetへ接続し、開発環境を通常どおり起動する。

```bash
mise run dev
```

Windows PowerShellでTailscale Serveを開始する。

```powershell
tailscale serve --bg 3000
tailscale serve status
```

表示されたHTTPS URLの末尾へ`/dev/image-conversion`を付け、端末で開く。

```text
https://<端末名>.<tailnet名>.ts.net/dev/image-conversion
```

検証後はServe設定と開発環境を停止する。

```powershell
tailscale serve reset
```

```bash
mise run down
```

Dockerは従来どおり`127.0.0.1`だけへ公開し、LANやInternetへ直接公開しない。Tailscaleへ接続していない端末からはアクセスできない。

## 確認画像

個人写真はrepositoryへ追加せず、端末から直接選択する。

- JPEG／PNG／WebPの縦・横画像
- 透過PNG
- iPhoneの12MP／48MP HEIC
- AndroidのHEIC／HEIF
- 20MBを超える画像
- AVIF、GIF、SVGなどの対象外形式
- 8枚中1枚だけ不正な画像

## 記録する内容

ページの「JSONをコピー」または「JSONを保存」で次を記録する。

- User-Agent
- 元画像の形式、容量、寸法
- メイン・サムネイルの容量と寸法
- デコード、変換、検証、SHA-256計算の時間
- 写真単位のエラーコード
- 使用したデコーダと遅延読み込み時間

画像そのものはIssueやrepositoryへ添付せず、計測JSONと目視結果だけをIssue #102へ記録する。

## 2026-08-31 Chrome検証

Windows Chrome 152でNokia HEIF conformance fixture 5件を確認したところ、Browser標準APIでは5件すべて`heic_decoder_required`になった。また、File APIの`type`は全件空文字だった。

この結果を受け、次をSpikeへ追加した。

- MIME・拡張子ではなく、先頭のマジックバイトと`ftyp`ブランドで入力形式を判定する
- `mif1`だけではHEICと断定せず、HEVC系互換ブランドを確認する
- AVIFブランドはMVP対象外として拒否する
- HEIC／HEIFだけ`heic-to`をdynamic importする
- JSONへデコードbackendとライブラリ読み込み時間を記録する

### heic-to 1.5.2での再検証

同じfixture 5件を`heic-to`の遅延フォールバック経由で再検証し、5件すべてWebP変換に成功した。

- 初回: ライブラリ読み込み513.4ms、デコード1288.9ms、処理全体1495.4ms
- 2件目以降: デコード229.9〜271.9ms、処理全体432.7〜498.0ms
- メインWebP: 5件合計533,194bytes、平均約106.6KB
- サムネイルWebP: 5件合計63,922bytes、平均約12.8KB

ただし、複数画像を含むfixtureではprimary itemを選択できていない。

- `C007`は2560×1440のgridがprimary itemだが、1280×720の先頭画像を変換した
- `C005`は128×72のthumbnailがprimary itemだが、1280×720の先頭画像を変換した
- `heic-to 1.5.2`のworker実装は、libheifのデコード結果から`data[0]`を使用している

したがって、通常の単一写真を変換する性能はMVP候補として十分だが、「常にprimary itemを使用する」という仕様への適合は未確認ではなく不適合である。本番採用は、実際のiPhone／Androidカメラ由来HEICでの確認と、MVPで複数画像HEICをどこまで扱うかの判断後に決定する。

### libheif-js 1.19.8との比較

`libheif-js/wasm-bundle`を専用Web Workerから使用し、primary itemを直接取得する薄いadapterを追加した。primaryが返されない場合だけtop-level画像の先頭へfallbackする。

`libheif-js 1.19.8`の`HeifImage#is_primary()`は内部の未定義関数を参照して失敗する。また、top-level画像の列挙だけではthumbnailとして格納されたprimary itemを取得できない。このため、公開API`heif_js_context_get_primary_image_handle`からprimary handleを直接取得する。

検証画面で次の候補を切り替え、同じfixtureを比較できる。

- `libheif-js / primary選択`
- `heic-to / 先頭画像`

計測JSONには次を追加する。

- `decodedImageCount`: libheifが返したtop-level画像数
- `primaryItemSelection`: `primary`、`fallback-first`、`not-inspectable`のいずれか

production buildで生成された遅延chunkは、`libheif-js`側が約1.48MB・gzip約526KB、`heic-to`側が約3.00MB・gzip約737KBだった。

### libheif-js 1.19.8の最終結果

Windows上のElectron 42／Chromium 148で、同じfixture 5件をprimary直接取得adapter経由で再検証し、5件すべてWebP変換に成功した。

- 初回: ライブラリ読み込み499.4ms、デコード732.9ms、処理全体968.8ms
- 2件目以降: 処理全体161.0〜1082.9ms
- 5件の処理全体: 約3205.2ms
- メインWebP: 5件合計568,328bytes、平均約113.7KB
- サムネイルWebP: 5件合計55,952bytes、平均約11.2KB
- `C005`: thumbnailとして格納された128×72のprimary itemを取得
- `C007`: top-level画像5件から2560×1440のgrid primary itemを取得し、1920×1080へ変換

`heic-to`と比較して、`libheif-js`は遅延chunkが小さく、primary itemを直接取得できる。fixtureに対する成功率も5/5であるため、Issue #102では`libheif-js`を本実装の第一候補とする。比較用の2ライブラリはSpike用devDependencyのまま残し、本実装ではライセンス確認後に採用するライブラリだけをproduction dependencyへ追加する。

## 現時点の制約

- `heic-to`と`libheif-js`は比較を再現するためのSpike用devDependencyであり、本実装にはまだ含めない
- package licenseはLGPL-3.0のため、本番採用前に配布時のライセンス表示・ソース提供方法を確認する
- HEIC／HEIFでもBrowser標準APIでデコードできる環境ではライブラリを読み込まない
- HTTPなどSecure Contextではない環境では、画像選択前に検証を停止する
- 公開fixtureでは成功率・primary item・透過・所要時間を確認済み。実際のiPhone／Androidカメラ由来HEICでは未確認
- 実機画像で向き・文字や傷の視認性・処理時間を確認してからproduction dependencyへの移動を相談する
- このページはdevelopmentでだけ表示され、productionでは404になる
