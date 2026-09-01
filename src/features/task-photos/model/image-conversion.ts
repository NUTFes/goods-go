"use client";

export const TASK_PHOTO_LIMITS = {
  inputMaxBytes: 20 * 1024 * 1024,
  inputMaxPixels: 50_000_000,
  inputMaxLongEdge: 12_000,
  mainLongEdge: 1_920,
  mainQuality: 0.82,
  thumbnailLongEdge: 480,
  thumbnailQuality: 0.75,
  maxPhotos: 8,
} as const;

export const IMAGE_CONVERSION_SPIKE_ACCEPT = "image/*,.heic,.heif";

export type InputImageKind = "jpeg" | "png" | "webp" | "heic" | "heif";
export type HeicDecoderCandidate = "heic-to" | "libheif-js-primary";

export type ConversionStage =
  | "queued"
  | "decoding"
  | "validating"
  | "converting-main"
  | "converting-thumbnail"
  | "verifying"
  | "hashing"
  | "completed";

export type TaskPhotoConversionErrorCode =
  | "unsupported_format"
  | "file_too_large"
  | "dimensions_too_large"
  | "decode_failed"
  | "heic_decoder_required"
  | "webp_not_supported"
  | "conversion_failed"
  | "invalid_output";

export class TaskPhotoConversionError extends Error {
  readonly code: TaskPhotoConversionErrorCode;

  constructor(code: TaskPhotoConversionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TaskPhotoConversionError";
    this.code = code;
  }
}

export type PhotoDraft = {
  photoId: string;
  file: File;
};

export type ConversionDiagnostics = {
  inputKind: InputImageKind;
  decodeBackend: "browser-standard" | HeicDecoderCandidate;
  decoderLoadMs: number;
  decodedImageCount: number | null;
  primaryItemSelection: "browser-managed" | "not-inspectable" | "primary" | "fallback-first";
  inputBytes: number;
  inputWidth: number;
  inputHeight: number;
  decodeMs: number;
  mainConversionMs: number;
  thumbnailConversionMs: number;
  verificationAndHashMs: number;
  totalMs: number;
};

export type ConvertedTaskPhoto = {
  photoId: string;
  main: Blob;
  thumbnail: Blob;
  mainSha256: string;
  thumbnailSha256: string;
  width: number;
  height: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  diagnostics: ConversionDiagnostics;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

type DecodedInputImage = DecodedImage & {
  backend: ConversionDiagnostics["decodeBackend"];
  decoderLoadMs: number;
  decodedImageCount: number | null;
  primaryItemSelection: ConversionDiagnostics["primaryItemSelection"];
};

type ConvertOptions = {
  heicDecoder?: HeicDecoderCandidate;
  signal?: AbortSignal;
  onStageChange?: (stage: ConversionStage) => void;
};

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx"]);
const AVIF_BRANDS = new Set(["avif", "avis"]);
const HEADER_READ_BYTES = 4 * 1024;

type LibheifWorkerSuccess = {
  type: "success";
  id: string;
  width: number;
  height: number;
  rgbaBuffer: ArrayBuffer;
  imageCount: number;
  selectedPrimary: boolean;
};

type LibheifWorkerFailure = {
  type: "error";
  id: string;
  message: string;
};

type LibheifWorkerMessage =
  | { type: "ready" }
  | { type: "startup-error"; message: string }
  | LibheifWorkerSuccess
  | LibheifWorkerFailure;

type PendingLibheifDecode = {
  resolve: (result: LibheifWorkerSuccess) => void;
  reject: (error: Error) => void;
};

let libheifWorker: Worker | undefined;
let libheifWorkerReady: Promise<number> | undefined;
const pendingLibheifDecodes = new Map<string, PendingLibheifDecode>();

function matchesBytes(bytes: Uint8Array, expected: readonly number[], offset = 0): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return new TextDecoder("ascii").decode(bytes.subarray(offset, offset + length));
}

async function detectInputKind(file: File): Promise<InputImageKind> {
  const bytes = new Uint8Array(await file.slice(0, HEADER_READ_BYTES).arrayBuffer());

  if (bytes.length >= 3 && matchesBytes(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg";
  }

  if (bytes.length >= 8 && matchesBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }

  if (
    bytes.length >= 12 &&
    readAscii(bytes, 0, 4) === "RIFF" &&
    readAscii(bytes, 8, 4) === "WEBP"
  ) {
    return "webp";
  }

  if (bytes.length >= 16 && readAscii(bytes, 4, 4) === "ftyp") {
    const declaredBoxSize = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).getUint32(0, false);
    const boxEnd = Math.min(bytes.length, declaredBoxSize >= 16 ? declaredBoxSize : bytes.length);
    const brands = [readAscii(bytes, 8, 4)];

    for (let offset = 16; offset + 4 <= boxEnd; offset += 4) {
      brands.push(readAscii(bytes, offset, 4));
    }

    if (brands.some((brand) => AVIF_BRANDS.has(brand))) {
      throw new TaskPhotoConversionError("unsupported_format", "AVIFはMVPの対象外です");
    }

    if (brands.some((brand) => HEIC_BRANDS.has(brand))) {
      return brands[0] === "mif1" || brands[0] === "msf1" ? "heif" : "heic";
    }
  }

  throw new TaskPhotoConversionError(
    "unsupported_format",
    `画像の実データが対応形式ではありません: ${file.type || "MIME不明"}`,
  );
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("Aborted", "AbortError");
  }
}

async function decodeWithImageElement(file: Blob): Promise<DecodedImage> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;

  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(objectUrl),
  };
}

async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Safariを含む実機差分を確認するため、標準のImage要素へフォールバックする。
    }
  }

  return decodeWithImageElement(file);
}

function rejectPendingLibheifDecodes(error: Error): void {
  for (const pending of pendingLibheifDecodes.values()) {
    pending.reject(error);
  }
  pendingLibheifDecodes.clear();
}

async function ensureLibheifWorker(): Promise<{ worker: Worker; loadMs: number }> {
  if (libheifWorker && !libheifWorkerReady) {
    return { worker: libheifWorker, loadMs: 0 };
  }

  if (!libheifWorker) {
    const loadStartedAt = performance.now();
    const worker = new Worker(new URL("./libheif-primary.worker.ts", import.meta.url), {
      type: "module",
    });
    libheifWorker = worker;

    libheifWorkerReady = new Promise<number>((resolve, reject) => {
      worker.addEventListener("message", (event: MessageEvent<LibheifWorkerMessage>) => {
        const message = event.data;

        if (message.type === "ready") {
          resolve(performance.now() - loadStartedAt);
          return;
        }

        if (message.type === "startup-error") {
          reject(new Error(message.message));
          return;
        }

        const pending = pendingLibheifDecodes.get(message.id);
        if (!pending) return;

        pendingLibheifDecodes.delete(message.id);
        if (message.type === "success") {
          pending.resolve(message);
        } else {
          pending.reject(new Error(message.message));
        }
      });

      worker.addEventListener("error", (event) => {
        const error = new Error(event.message || "libheif-js worker error");
        reject(error);
        rejectPendingLibheifDecodes(error);
      });
    });
  }

  const worker = libheifWorker;
  const ready = libheifWorkerReady;
  if (!worker || !ready) {
    throw new Error("libheif-js workerを初期化できませんでした");
  }

  try {
    const loadMs = await ready;
    return { worker, loadMs };
  } catch (error) {
    worker.terminate();
    libheifWorker = undefined;
    throw error;
  } finally {
    libheifWorkerReady = undefined;
  }
}

async function decodeWithLibheifPrimary(file: File): Promise<DecodedInputImage> {
  const { worker, loadMs } = await ensureLibheifWorker();
  const id = crypto.randomUUID();
  const buffer = await file.arrayBuffer();
  const result = await new Promise<LibheifWorkerSuccess>((resolve, reject) => {
    pendingLibheifDecodes.set(id, { resolve, reject });
    worker.postMessage({ type: "decode", id, buffer }, [buffer]);
  });
  const imageData = new ImageData(
    new Uint8ClampedArray(result.rgbaBuffer),
    result.width,
    result.height,
  );
  const bitmap = await createImageBitmap(imageData);

  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    release: () => bitmap.close(),
    backend: "libheif-js-primary",
    decoderLoadMs: loadMs,
    decodedImageCount: result.imageCount,
    primaryItemSelection: result.selectedPrimary ? "primary" : "fallback-first",
  };
}

async function decodeWithHeicTo(file: File): Promise<DecodedInputImage> {
  const decoderLoadStartedAt = performance.now();
  const { heicTo } = await import("heic-to");
  const decoderLoadMs = performance.now() - decoderLoadStartedAt;

  const bitmap = await heicTo({
    blob: file,
    type: "bitmap",
    options: { imageOrientation: "from-image" },
  });

  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    release: () => bitmap.close(),
    backend: "heic-to",
    decoderLoadMs,
    decodedImageCount: null,
    primaryItemSelection: "not-inspectable",
  };
}

async function decodeInputImage(
  file: File,
  inputKind: InputImageKind,
  heicDecoder: HeicDecoderCandidate,
): Promise<DecodedInputImage> {
  try {
    return {
      ...(await decodeImage(file)),
      backend: "browser-standard",
      decoderLoadMs: 0,
      decodedImageCount: null,
      primaryItemSelection: "browser-managed",
    };
  } catch (standardDecodeError) {
    if (inputKind !== "heic" && inputKind !== "heif") {
      throw standardDecodeError;
    }
  }

  try {
    return heicDecoder === "libheif-js-primary"
      ? await decodeWithLibheifPrimary(file)
      : await decodeWithHeicTo(file);
  } catch (error) {
    throw new TaskPhotoConversionError(
      "decode_failed",
      `${heicDecoder}でHEIC／HEIFをデコードできませんでした`,
      { cause: error },
    );
  }
}

function calculateTargetSize(width: number, height: number, maxLongEdge: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width, height };
  }

  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function canvasToWebp(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxLongEdge: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const target = calculateTargetSize(sourceWidth, sourceHeight, maxLongEdge);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    throw new TaskPhotoConversionError(
      "conversion_failed",
      "Canvas 2Dコンテキストを作成できませんでした",
    );
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, target.width, target.height);

  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });

    if (!blob) {
      throw new TaskPhotoConversionError(
        "conversion_failed",
        "Canvasから画像Blobを生成できませんでした",
      );
    }

    if (blob.type !== "image/webp") {
      throw new TaskPhotoConversionError(
        "webp_not_supported",
        `BrowserがWebPを生成できませんでした: ${blob.type || "MIME不明"}`,
      );
    }

    return { blob, ...target };
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

async function verifyOutput(blob: Blob, width: number, height: number): Promise<void> {
  if (blob.size === 0 || blob.type !== "image/webp") {
    throw new TaskPhotoConversionError("invalid_output", "変換後のWebPが不正です");
  }

  let decoded: DecodedImage;
  try {
    decoded = await decodeImage(blob);
  } catch (error) {
    throw new TaskPhotoConversionError(
      "invalid_output",
      "変換後のWebPを再デコードできませんでした",
      { cause: error },
    );
  }

  try {
    if (decoded.width !== width || decoded.height !== height) {
      throw new TaskPhotoConversionError(
        "invalid_output",
        `変換後の寸法が一致しません: expected=${width}x${height}, actual=${decoded.width}x${decoded.height}`,
      );
    }
  } finally {
    decoded.release();
  }
}

async function sha256Hex(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validateInputDimensions(width: number, height: number): void {
  const pixels = width * height;
  const longEdge = Math.max(width, height);

  if (
    width <= 0 ||
    height <= 0 ||
    pixels > TASK_PHOTO_LIMITS.inputMaxPixels ||
    longEdge > TASK_PHOTO_LIMITS.inputMaxLongEdge
  ) {
    throw new TaskPhotoConversionError(
      "dimensions_too_large",
      `画像寸法が上限を超えています: ${width}x${height}`,
    );
  }
}

export async function convertTaskPhoto(
  draft: PhotoDraft,
  options: ConvertOptions = {},
): Promise<ConvertedTaskPhoto> {
  const startedAt = performance.now();

  if (draft.file.size > TASK_PHOTO_LIMITS.inputMaxBytes) {
    throw new TaskPhotoConversionError(
      "file_too_large",
      `入力画像が20MBを超えています: ${draft.file.size} bytes`,
    );
  }

  const inputKind = await detectInputKind(draft.file);

  throwIfAborted(options.signal);
  options.onStageChange?.("decoding");
  const decodeStartedAt = performance.now();

  let decoded: DecodedInputImage;
  try {
    decoded = await decodeInputImage(
      draft.file,
      inputKind,
      options.heicDecoder ?? "libheif-js-primary",
    );
  } catch (error) {
    if (
      (inputKind === "heic" || inputKind === "heif") &&
      !(error instanceof TaskPhotoConversionError)
    ) {
      throw new TaskPhotoConversionError(
        "heic_decoder_required",
        "HEIC／HEIFデコーダを読み込めませんでした",
        { cause: error },
      );
    }

    if (error instanceof TaskPhotoConversionError) {
      throw error;
    }

    throw new TaskPhotoConversionError("decode_failed", "入力画像をデコードできませんでした", {
      cause: error,
    });
  }

  const decodeMs = performance.now() - decodeStartedAt;

  try {
    throwIfAborted(options.signal);
    options.onStageChange?.("validating");
    validateInputDimensions(decoded.width, decoded.height);

    options.onStageChange?.("converting-main");
    const mainStartedAt = performance.now();
    const main = await canvasToWebp(
      decoded.source,
      decoded.width,
      decoded.height,
      TASK_PHOTO_LIMITS.mainLongEdge,
      TASK_PHOTO_LIMITS.mainQuality,
    );
    const mainConversionMs = performance.now() - mainStartedAt;

    throwIfAborted(options.signal);
    options.onStageChange?.("converting-thumbnail");
    const thumbnailStartedAt = performance.now();
    const thumbnail = await canvasToWebp(
      decoded.source,
      decoded.width,
      decoded.height,
      TASK_PHOTO_LIMITS.thumbnailLongEdge,
      TASK_PHOTO_LIMITS.thumbnailQuality,
    );
    const thumbnailConversionMs = performance.now() - thumbnailStartedAt;

    throwIfAborted(options.signal);
    const verificationStartedAt = performance.now();
    options.onStageChange?.("verifying");
    await Promise.all([
      verifyOutput(main.blob, main.width, main.height),
      verifyOutput(thumbnail.blob, thumbnail.width, thumbnail.height),
    ]);

    options.onStageChange?.("hashing");
    const [mainSha256, thumbnailSha256] = await Promise.all([
      sha256Hex(main.blob),
      sha256Hex(thumbnail.blob),
    ]);
    const verificationAndHashMs = performance.now() - verificationStartedAt;

    options.onStageChange?.("completed");
    return {
      photoId: draft.photoId,
      main: main.blob,
      thumbnail: thumbnail.blob,
      mainSha256,
      thumbnailSha256,
      width: main.width,
      height: main.height,
      thumbnailWidth: thumbnail.width,
      thumbnailHeight: thumbnail.height,
      diagnostics: {
        inputKind,
        decodeBackend: decoded.backend,
        decoderLoadMs: decoded.decoderLoadMs,
        decodedImageCount: decoded.decodedImageCount,
        primaryItemSelection: decoded.primaryItemSelection,
        inputBytes: draft.file.size,
        inputWidth: decoded.width,
        inputHeight: decoded.height,
        decodeMs,
        mainConversionMs,
        thumbnailConversionMs,
        verificationAndHashMs,
        totalMs: performance.now() - startedAt,
      },
    };
  } finally {
    decoded.release();
  }
}

export function normalizeConversionError(error: unknown): {
  code: TaskPhotoConversionErrorCode | "unknown";
  message: string;
} {
  if (error instanceof TaskPhotoConversionError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof Error) {
    return { code: "unknown", message: error.message };
  }

  return { code: "unknown", message: "不明なエラーが発生しました" };
}
