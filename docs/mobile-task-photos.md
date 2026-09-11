# Mobile写真登録の実装範囲

Issue #104の写真選択・変換・保存を実装する。

## 既存機能との接続

- Mobileのタスク詳細に写真欄を追加する。PC画面は変更しない。
- 認証済みSupabase Browser clientからprivate `task-photos`へ送信し、既存`apply_task_photo_changes` RPCで確定する。
- 保存するのは長辺最大1920px・品質82%・3MiB以下のJPEGのみ。小さい写真は拡大せず、透過部分は白にする。
- 写真は0〜8枚。選択配列順でIDを発行し、同じ順でRPCへ渡す。変換と送信は逐次実行する。
- 送信失敗後も他の写真を処理する。全対象の送信成功後だけRPCを呼ぶ。
- 送信再試行では同じIDを使用する。重複objectはRPC確定へ進み、権限エラーは重複扱いにしない。
- RPCの応答を確認できない場合は編集を止め、手動の「保存結果を確認」で再取得・同じIDのRPC再試行を行う。
- 保存済み写真は削除予定を付け、保存前に枚数を確認する。Storageの物理削除は行わない。
- 完了中は全ロールが閲覧専用。写真操作でステータスを変更しない。
- 編集は画面内stateだけで保持する。未保存で閉じる場合は確認し、写真保存中は閉じる操作を抑止する。

## 画像変換の制約

- 入力候補はJPEG／PNG／WebP／HEIC／HEIF。MIMEや拡張子ではなく、ファイル先頭のシグネチャと`ftyp`ブランドで実データを判定する。
- `mif1`／`msf1`だけではHEIFと断定せず、HEVC系の互換ブランドを必要とする。AVIFブランドは対象外として拒否する。
- 20MB（20,000,000 bytes）、50MP、長辺12,000pxを上限にする。寸法判定は標準APIでのデコード後なので、事前のメモリ上限保証ではない。
- JPEG／PNG／WebPとブラウザが読めるHEIC／HEIFは標準APIを使う。標準APIで読めないHEIC／HEIFだけ、`libheif-js` 1.19.8をWeb Worker内へ遅延読み込みする。
- HEIC fallbackではRGBA確保前に16MP上限を適用し、primary itemを取得する。取得できない画像だけtop-level画像の先頭へfallbackする。
- 独自デコーダー、独自EXIF解析、`heic-to`、将来用の変換ラッパーは追加しない。
- `libheif-js`はLGPL-3.0であり、版・ソース・ライセンスを`THIRD_PARTY_NOTICES.md`へ記録する。法的判断そのものはレビュー対象とする。

## 検査

依存追加なしで境界テストを実行できる（Node 24）。Canvasはテスト用の代替を使い、実機の画質・向きの検証とは区別する。

```sh
mise exec -- node --test tests/task-photos.test.mjs
mise run typecheck
mise run lint
mise run build
```

2026-09-09にローカルSupabaseでUserのupload、重複upload、RPC再試行、登録順、signed URL取得、論理削除、ステータス不変、完了時のUser／Adminの拒否を確認した。専用の一時タスクと画像は検査後に削除した。

2026-09-11にChromeのDevice Emulation（393×852、DPR 2）で次を確認した。

- 写真0枚・1枚・8枚の表示、8枚時の追加抑止
- JPEG／PNG／WebPの選択、JPEG変換、保存、詳細を開き直した後の再表示
- 削除予定、削除確認、削除保存、未保存変更の取り消し・破棄
- Userの未完了タスクでの写真編集と、User／Adminの完了タスクでの閲覧専用表示
- 横スクロールや写真欄のはみ出しがないこと

同日にMobile Figma node `3132:175039`と比較した。4列の写真タイル、追加・削除操作、44px高の保存・取り消しボタンは一致している。枚数表示、写真0枚の案内、写真とステータスを分けた保存操作は、確定した仕様を反映した意図的な差分である。正常時には不要な再読み込み操作を表示せず、取得失敗時だけ表示する。

今回のUIへ組み込んだHEIC fallback、iPhone／Android実機上の本画面、UIからの通信断・競合操作は未確認。変換モジュール単体では、Spike時にAndroidの実HEICを含めて確認済みである。IndexedDB、自動再送、upload状態機械、GC、バックアップ、保存サムネイル、SHA-256は実装しない。
