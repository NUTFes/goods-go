"use client";

import { Copy, Download, Images, Play, RotateCcw, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  IMAGE_CONVERSION_SPIKE_ACCEPT,
  TASK_PHOTO_LIMITS,
  convertTaskPhoto,
  normalizeConversionError,
  type ConversionStage,
  type ConvertedTaskPhoto,
  type PhotoDraft,
} from "@/features/task-photos/model/image-conversion";

type QueueStatus = "queued" | "processing" | "success" | "error";

type QueueItem = PhotoDraft & {
  originalUrl: string;
  status: QueueStatus;
  stage: ConversionStage;
  result?: ConvertedTaskPhoto;
  mainUrl?: string;
  thumbnailUrl?: string;
  error?: ReturnType<typeof normalizeConversionError>;
};

const STAGE_LABELS: Record<ConversionStage, string> = {
  queued: "待機中",
  decoding: "デコード中",
  validating: "入力検証中",
  "converting-main": "メイン画像を変換中",
  "converting-thumbnail": "サムネイルを変換中",
  verifying: "出力検証中",
  hashing: "SHA-256を計算中",
  completed: "完了",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatMilliseconds(milliseconds: number): string {
  return `${milliseconds.toFixed(1)} ms`;
}

function progressForStage(stage: ConversionStage): number {
  const stages: ConversionStage[] = [
    "queued",
    "decoding",
    "validating",
    "converting-main",
    "converting-thumbnail",
    "verifying",
    "hashing",
    "completed",
  ];
  return (stages.indexOf(stage) / (stages.length - 1)) * 100;
}

export function ImageConversionSpike() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasSecureContext, setHasSecureContext] = useState<boolean | null>(null);
  const objectUrls = useRef(new Set<string>());

  const registerObjectUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    objectUrls.current.add(url);
    return url;
  };

  const revokeAllObjectUrls = () => {
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current.clear();
  };

  useEffect(() => {
    setHasSecureContext(
      globalThis.isSecureContext &&
        typeof crypto.randomUUID === "function" &&
        crypto.subtle !== undefined,
    );
    return revokeAllObjectUrls;
  }, []);

  const report = useMemo(
    () => ({
      measuredAt: new Date().toISOString(),
      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
      settings: TASK_PHOTO_LIMITS,
      summary: {
        selected: items.length,
        succeeded: items.filter((item) => item.status === "success").length,
        failed: items.filter((item) => item.status === "error").length,
        mainBytes: items.reduce((total, item) => total + (item.result?.main.size ?? 0), 0),
        thumbnailBytes: items.reduce(
          (total, item) => total + (item.result?.thumbnail.size ?? 0),
          0,
        ),
        totalProcessingMs: items.reduce(
          (total, item) => total + (item.result?.diagnostics.totalMs ?? 0),
          0,
        ),
      },
      results: items.map((item) => ({
        photoId: item.photoId,
        fileName: item.file.name,
        declaredMime: item.file.type,
        status: item.status,
        error: item.error,
        ...(item.result
          ? {
              input: item.result.diagnostics,
              main: {
                bytes: item.result.main.size,
                width: item.result.width,
                height: item.result.height,
                sha256: item.result.mainSha256,
              },
              thumbnail: {
                bytes: item.result.thumbnail.size,
                width: item.result.thumbnailWidth,
                height: item.result.thumbnailHeight,
                sha256: item.result.thumbnailSha256,
              },
            }
          : {}),
      })),
    }),
    [items],
  );

  const reportJson = JSON.stringify(report, null, 2);
  const successfulItems = items.filter((item) => item.result !== undefined);
  const totalMainBytes = successfulItems.reduce(
    (total, item) => total + (item.result?.main.size ?? 0),
    0,
  );
  const totalThumbnailBytes = successfulItems.reduce(
    (total, item) => total + (item.result?.thumbnail.size ?? 0),
    0,
  );
  const totalProcessingMs = successfulItems.reduce(
    (total, item) => total + (item.result?.diagnostics.totalMs ?? 0),
    0,
  );

  const replaceFiles = (files: File[]) => {
    if (!hasSecureContext) {
      setNotice("この検証にはHTTPSまたはlocalhostのSecure Contextが必要です");
      return;
    }

    revokeAllObjectUrls();
    const selectedFiles = files.slice(0, TASK_PHOTO_LIMITS.maxPhotos);
    setItems(
      selectedFiles.map((file) => ({
        photoId: crypto.randomUUID(),
        file,
        originalUrl: registerObjectUrl(file),
        status: "queued",
        stage: "queued",
      })),
    );
    setNotice(
      files.length > TASK_PHOTO_LIMITS.maxPhotos
        ? `先頭${TASK_PHOTO_LIMITS.maxPhotos}枚だけを選択しました`
        : null,
    );
  };

  const updateItem = (photoId: string, update: Partial<QueueItem>) => {
    setItems((current) =>
      current.map((item) => (item.photoId === photoId ? { ...item, ...update } : item)),
    );
  };

  const runConversions = async () => {
    const targets = items.filter((item) => item.status === "queued" || item.status === "error");
    if (targets.length === 0) return;

    setIsRunning(true);
    setNotice(null);

    for (const item of targets) {
      updateItem(item.photoId, {
        status: "processing",
        stage: "decoding",
        error: undefined,
      });

      try {
        const result = await convertTaskPhoto(
          { photoId: item.photoId, file: item.file },
          {
            onStageChange: (stage) => updateItem(item.photoId, { stage }),
          },
        );

        updateItem(item.photoId, {
          result,
          mainUrl: registerObjectUrl(result.main),
          thumbnailUrl: registerObjectUrl(result.thumbnail),
          status: "success",
          stage: "completed",
        });
      } catch (error) {
        updateItem(item.photoId, {
          status: "error",
          error: normalizeConversionError(error),
        });
      }
    }

    setIsRunning(false);
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportJson);
      setNotice("検証結果をClipboardへコピーしました");
    } catch {
      setNotice("Clipboardへコピーできませんでした。JSON表示から手動でコピーしてください");
    }
  };

  const downloadReport = () => {
    const url = registerObjectUrl(new Blob([reportJson], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `image-conversion-${new Date().toISOString().replaceAll(":", "-")}.json`;
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      objectUrls.current.delete(url);
    });
  };

  const reset = () => {
    revokeAllObjectUrls();
    setItems([]);
    setNotice(null);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">Issue #102 / Development only</p>
        <h1 className="text-2xl font-bold md:text-3xl">画像WebP変換の実機検証</h1>
        <p className="text-muted-foreground">
          Browser標準APIだけで1枚ずつ変換します。写真や変換結果はサーバーへ送信しません。
        </p>
      </div>

      <Alert>
        <Images />
        <AlertTitle>検証条件</AlertTitle>
        <AlertDescription>
          メイン: 長辺1920px・品質82% / サムネイル: 長辺480px・品質75% / 最大8枚
        </AlertDescription>
      </Alert>

      {hasSecureContext === false && (
        <Alert variant="destructive">
          <AlertTitle>Secure Contextが必要です</AlertTitle>
          <AlertDescription>
            PCではlocalhost、実機ではTailscale ServeなどのHTTPS URLから開いてください。
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. 画像を選択</CardTitle>
          <CardDescription>
            JPEG、PNG、WebP、HEIC／HEIFを選べます。AVIF、GIF、SVG、動画は対象外です。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <label>
              <Upload />
              画像を選択
              <input
                className="sr-only"
                type="file"
                accept={IMAGE_CONVERSION_SPIKE_ACCEPT}
                multiple
                disabled={isRunning || hasSecureContext !== true}
                onChange={(event) => {
                  replaceFiles(Array.from(event.target.files ?? []));
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isRunning || items.length === 0}
            onClick={runConversions}
          >
            <Play />
            {items.some((item) => item.status === "error") ? "失敗分を再試行" : "変換を開始"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isRunning || items.length === 0}
            onClick={reset}
          >
            <RotateCcw />
            クリア
          </Button>
        </CardContent>
      </Card>

      {notice && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4">
        {items.map((item, index) => (
          <Card key={item.photoId}>
            <CardHeader>
              <CardTitle className="break-all text-base">
                {index + 1}. {item.file.name}
              </CardTitle>
              <CardDescription>
                {item.file.type || "MIME不明"} / {formatBytes(item.file.size)} / {item.photoId}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {item.status === "processing" && (
                <div className="space-y-2">
                  <p className="text-sm">{STAGE_LABELS[item.stage]}</p>
                  <Progress value={progressForStage(item.stage)} />
                </div>
              )}

              {item.error && (
                <Alert variant="destructive">
                  <AlertTitle>{item.error.code}</AlertTitle>
                  <AlertDescription>{item.error.message}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <Preview label="元画像" url={item.originalUrl} />
                <Preview label="メインWebP" url={item.mainUrl} />
                <Preview label="サムネイルWebP" url={item.thumbnailUrl} />
              </div>

              {item.result && (
                <div className="grid gap-3 rounded-lg bg-neutral-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label="判定形式"
                    value={item.result.diagnostics.inputKind.toUpperCase()}
                  />
                  <Metric
                    label="入力寸法"
                    value={`${item.result.diagnostics.inputWidth} × ${item.result.diagnostics.inputHeight}`}
                  />
                  <Metric
                    label="メイン"
                    value={`${item.result.width} × ${item.result.height} / ${formatBytes(item.result.main.size)}`}
                  />
                  <Metric
                    label="サムネイル"
                    value={`${item.result.thumbnailWidth} × ${item.result.thumbnailHeight} / ${formatBytes(item.result.thumbnail.size)}`}
                  />
                  <Metric
                    label="合計時間"
                    value={formatMilliseconds(item.result.diagnostics.totalMs)}
                  />
                  <Metric
                    label="デコード"
                    value={formatMilliseconds(item.result.diagnostics.decodeMs)}
                  />
                  <Metric
                    label="メイン変換"
                    value={formatMilliseconds(item.result.diagnostics.mainConversionMs)}
                  />
                  <Metric
                    label="サムネイル変換"
                    value={formatMilliseconds(item.result.diagnostics.thumbnailConversionMs)}
                  />
                  <Metric
                    label="検証＋Hash"
                    value={formatMilliseconds(item.result.diagnostics.verificationAndHashMs)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. 検証結果</CardTitle>
            <CardDescription>端末情報と計測値をIssue #102へ貼り付けられます。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-lg bg-neutral-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="成功" value={`${successfulItems.length} / ${items.length}枚`} />
              <Metric label="メイン合計" value={formatBytes(totalMainBytes)} />
              <Metric label="サムネイル合計" value={formatBytes(totalThumbnailBytes)} />
              <Metric label="処理時間合計" value={formatMilliseconds(totalProcessingMs)} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={copyReport}>
                <Copy />
                JSONをコピー
              </Button>
              <Button type="button" variant="outline" onClick={downloadReport}>
                <Download />
                JSONを保存
              </Button>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-medium">JSONを表示</summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-neutral-950 p-4 text-xs text-neutral-50">
                {reportJson}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function Preview({ label, url }: { label: string; url?: string }) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{label}</figcaption>
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border bg-neutral-100">
        {url ? (
          // Blob URLを比較表示する開発専用画面のため、Next Image最適化を使用しない。
          // eslint-disable-next-line @next/next/no-img-element
          <img className="h-full w-full object-contain" src={url} alt={`${label}のプレビュー`} />
        ) : (
          <span className="text-muted-foreground text-sm">未生成</span>
        )}
      </div>
    </figure>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="break-all font-mono">{value}</p>
    </div>
  );
}
