# 画像変換Spikeの実機確認結果

Issue #102でBrowser標準APIとHEICデコーダ候補を比較した記録である。

検証ページと比較用依存はLGPL確認前のProduction buildへ含めず、最終PRではこの記録だけをmainへ入れる。検証時点のコードはcommit `731fc78`に残す。

JPEG／PNG／WebPはBrowser標準APIを使用した。HEIC／HEIFは標準APIを先に試し、失敗した場合だけ比較対象のHEIC decoderを遅延読み込みした。

## PCで確認する

再現する場合はmainの作業ツリーを変更せず、検証commitから一時worktreeを作る。

```bash
git worktree add ../goods-go-image-spike 731fc78
cd ../goods-go-image-spike
mise run dev
```

起動後、次を開く。

```text
http://localhost:3000/dev/image-conversion
```

## iPhone／Androidで確認する

AndroidではUSBデバッグを有効にし、ADB reverseでPCのlocalhostへ接続した。

```powershell
adb reverse tcp:3000 tcp:3000
```

Android Chromeで次を開く。

```text
http://localhost:3000/dev/image-conversion
```

検証後は転送を解除する。

```powershell
adb reverse --remove tcp:3000
```

iPhone検証時だけ、利用者の承認後にCloudflare Quick Tunnelで一時HTTPS URLを発行した。Quick TunnelはURLを知る人から到達可能になるため、URLを共有せず検証直後に停止した。大学LAN内のP2P接続やDockerのLAN直接公開は使用していない。

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

### 高画素HEICのメモリ検証

iPhoneがない環境でもWASM fallbackのメモリ特性を確認できるよう、`libheif 1.23.0`で合成HEICをrepository外に生成した。Node.js上でBrowser Workerと同じlibheif decode処理を実行し、RGBA確保前後のRSSを計測した。

- 12MP相当（4032×3024）を8回逐次処理: RGBA約47MB／枚、初回RSS約203MB、2回目以降のdecode後RSS約205MBで推移
- 48MP相当（8000×6000）: RGBA約183MB、decode後RSS約608MB
- 50MP超（8400×6000）: 寸法取得後、RGBAを確保せず拒否

48MPをWASMで全面展開する方式はMobile向けMVPとして安全とは判断できない。このため、全形式共通の入力上限50MPとは別に、Browser標準APIでHEICを処理できず`libheif-js`へfallbackした場合だけ16MPを上限とする。一般的な12MP画像は許可し、48MP画像は`dimensions_too_large`として写真単位で失敗させる。

上限判定はprimary itemのhandleから寸法を取得した直後、`ImageData`確保より前に行う。また、WorkerからRGBAを転送するときは`Uint8ClampedArray#slice()`による全画素コピーを行わず、元の`ArrayBuffer`をtransferする。

### 12MP×8枚のBrowser検証

同じ12MP合成HEICを8ファイル用意し、同時変換数1で連続処理した。

- Windows Chrome 152: 8/8成功、合計約6467.5ms
- Chrome初回: decoder読み込み505.1ms、処理全体1484.1ms
- Chrome 2枚目以降: 1枚あたり約652.9〜794.6ms
- VS Code Electron 42／Chromium 148: 8/8成功、合計約6954.8ms
- Electronの混在8枚試験: 通常5枚と12MP 1枚は成功し、48MPと50MP超の2枚だけ`dimensions_too_large`。失敗後も後続写真の処理を継続した

合成画像は単純なgradientであり、変換後容量は実写真より大幅に小さい。この結果は連続処理時間、処理継続、寸法上限の確認だけに使用し、容量や文字・傷の視認性評価には使用しない。

### iPhone Safariの実機検証

iPhone OS 18.7／Safari 26.6.1で、写真ライブラリにある4032×3024の実写真1枚を検証した。

- 選択時点でファイル名`image.jpg`、MIME`image/jpeg`となり、iOSがHEICからJPEGへ変換してBrowserへ渡した
- Canvasへ`image/webp`を指定すると`image/png`が返り、WebP固定の変換は`webp_not_supported`となった
- Canvas標準APIによるJPEG出力は成功した
- 入力: 3,164,532bytes、4032×3024
- メイン: 837,701bytes、1920×1440、品質82%
- サムネイル: 70,460bytes、480×360、品質75%
- 合計処理時間: 175ms（デコード80ms、メイン変換58ms、サムネイル変換3ms、検証とHash 24ms）
- 実機のプレビューで向き、画質、視認性に問題がないことを確認した

この実測から、MVPの正規出力形式はJPEGを第一候補とする。Safari用WebPエンコーダーは追加せず、標準Canvas APIを優先する。これは出力形式の判断であり、AndroidなどがHEICをそのままBrowserへ渡す場合に備えた入力HEICデコーダーの要否は別途実機確認する。

### Android Chromeの実機検証

Samsung SC-51B／Chrome 151で、カメラ由来のHEICをJPEGへ変換した。

- Androidはファイル名とMIMEを`.heic`／`image/heic`のままBrowserへ渡した
- `libheif-js-primary`でprimary itemを取得し、2268×4032から1080×1920へ向きを維持して変換した
- 入力: 942,632bytes
- メイン: 180,688bytes、品質82%
- サムネイル: 16,361bytes、品質75%
- 合計処理時間: 約1.75〜1.93秒。初回のdecoder読み込みは約349ms
- 同じ実写真を再変換した出力SHA-256は一致した

別のHEIC 1枚は、単独で選び直しても先頭4KBの読み取り時点でBrowserの`NotReadableError`となった。HEICデコーダーへ渡る前の端末／ファイル参照固有の失敗であるため、同じ`File`参照の自動再試行は行わず、`file_not_readable`として写真の選び直しを案内する。

この実測から、Android向けにはHEICデコーダーが必要と判断する。MVPはJPEGを正規出力とし、標準APIで入力HEICを読めない場合だけ`libheif-js`を遅延読み込みする。

### 本実装へ持ち込む最小範囲

Spikeでは容量比較のためメイン、サムネイル、両方のSHA-256を生成した。本実装のMVPでは次だけを持ち込む。

- 長辺1920px・品質82%のメインJPEG 1個
- 標準APIで読めないHEIC／HEIFに限る`libheif-js`の遅延読み込み
- 入力上限、変換後の再デコード検証、写真単位の失敗分離、画像リソース解放
- `file_not_readable`では同じ`File`参照を再試行せず、写真の選び直しを案内する

保存用サムネイルとクライアントSHA-256はMVPへ持ち込まない。PCの写真確認画面はメインJPEGを遅延読み込みし、必要性を実測してからサムネイルを追加する。

## 現時点の制約

- `heic-to`と`libheif-js`はcommit `731fc78`で比較したが、最終PRの依存には含めない
- package licenseはLGPL-3.0のため、本番採用前に配布時のライセンス表示・ソース提供方法を確認する
- HEIC／HEIFでもBrowser標準APIでデコードできる環境ではライブラリを読み込まない
- HTTPなどSecure Contextではない環境では、画像選択前に検証を停止する
- 公開fixtureに加え、iPhoneのOSによるJPEG変換とAndroidカメラ由来HEICのWASM変換を実機確認済み
- WASM fallback時は16MPを超えるHEIC／HEIFを安全上の理由で拒否する。Browser標準APIで処理できる場合は全形式共通の50MP上限を適用する
- 24MP以上のiPhone写真は未確認であり、#104着手前の実機確認事項とする
- 検証ページは最終PRへ含めず、Production buildへ到達させない
