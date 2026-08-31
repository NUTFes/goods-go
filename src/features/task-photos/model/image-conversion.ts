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

type ConvertOptions = {
  signal?: AbortSignal;
  onStageChange?: (stage: ConversionStage) => void;
};

const MIME_TO_KIND: Readonly<Record<string, InputImageKind>> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const EXTENSION_TO_KIND: Readonly<Record<string, InputImageKind>> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  heic: "heic",
  heif: "heif",
};

function detectInputKind(file: File): InputImageKind {
  const mimeKind = MIME_TO_KIND[file.type.toLowerCase()];
  if (mimeKind) {
    return mimeKind;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const extensionKind = extension ? EXTENSION_TO_KIND[extension] : undefined;
  if (extensionKind) {
    return extensionKind;
  }

  throw new TaskPhotoConversionError(
    "unsupported_format",
    `対応していない画像形式です: ${file.type || "MIME不明"}`,
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
  const inputKind = detectInputKind(draft.file);

  if (draft.file.size > TASK_PHOTO_LIMITS.inputMaxBytes) {
    throw new TaskPhotoConversionError(
      "file_too_large",
      `入力画像が20MBを超えています: ${draft.file.size} bytes`,
    );
  }

  throwIfAborted(options.signal);
  options.onStageChange?.("decoding");
  const decodeStartedAt = performance.now();

  let decoded: DecodedImage;
  try {
    decoded = await decodeImage(draft.file);
  } catch (error) {
    if (inputKind === "heic" || inputKind === "heif") {
      throw new TaskPhotoConversionError(
        "heic_decoder_required",
        "このBrowserではHEIC／HEIFを標準APIでデコードできません",
        { cause: error },
      );
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
