# 画像変換Spikeの実機確認

Issue #102の開発専用ページで、Browser標準APIによるWebP変換を確認する。

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

画像そのものはIssueやrepositoryへ添付せず、計測JSONと目視結果だけをIssue #102へ記録する。

## 現時点の制約

- 追加ライブラリは導入していない
- HEIC／HEIFをBrowser標準APIでデコードできない場合は`heic_decoder_required`になる
- HTTPなどSecure Contextではない環境では、画像選択前に検証を停止する
- 標準APIで不足することを確認した後、HEICデコーダ候補を比較してproduction dependency追加前に相談する
- このページはdevelopmentでだけ表示され、productionでは404になる
