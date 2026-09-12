export const TASK_PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";
export const TASK_PHOTO_LIMIT = 8;
const MAX_INPUT_BYTES = 20_000_000;
const MAX_OUTPUT_BYTES = 3 * 1024 * 1024;
const MAX_INPUT_PIXELS = 50_000_000;
const MAX_INPUT_LONG_EDGE = 12_000;
const HEADER_READ_BYTES = 4 * 1024;
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx"]);
const AVIF_BRANDS = new Set(["avif", "avis"]);

type InputKind = "jpeg" | "png" | "webp" | "heic" | "heif";
type DecodedPhoto = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};
type WorkerMessage =
  | { type: "ready" }
  | { type: "startup-error"; message: string }
  | {
      type: "success";
      id: string;
      width: number;
      height: number;
      rgbaBuffer: ArrayBuffer;
    }
  | {
      type: "error";
      id: string;
      code: "decode_failed" | "dimensions_too_large";
      message: string;
    };

export class TaskPhotoConversionError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.retryable = retryable;
  }
}

function matches(bytes: Uint8Array, expected: readonly number[], offset = 0) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  return new TextDecoder("ascii").decode(bytes.subarray(offset, offset + length));
}

function detectInputKind(buffer: ArrayBuffer): InputKind {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, HEADER_READ_BYTES));
  if (bytes.length >= 3 && matches(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (bytes.length >= 8 && matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
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
    const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
      0,
      false,
    );
    const boxEnd = Math.min(bytes.length, boxSize >= 16 ? boxSize : bytes.length);
    const brands = [readAscii(bytes, 8, 4)];
    for (let offset = 16; offset + 4 <= boxEnd; offset += 4) {
      brands.push(readAscii(bytes, offset, 4));
    }
    if (brands.some((brand) => AVIF_BRANDS.has(brand))) {
      throw new TaskPhotoConversionError("AVIFは現在登録できません。別の形式を選んでください。");
    }
    if (brands.some((brand) => HEIC_BRANDS.has(brand))) {
      return brands[0] === "mif1" || brands[0] === "msf1" ? "heif" : "heic";
    }
  }
  throw new TaskPhotoConversionError("JPEG・PNG・WebP・HEIC／HEIFの写真を選んでください。");
}

function mimeFor(kind: InputKind) {
  return kind === "jpeg" ? "image/jpeg" : `image/${kind}`;
}

async function decodeWithImageElement(blob: Blob): Promise<DecodedPhoto> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => {
        image.src = "";
        URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    image.src = "";
    URL.revokeObjectURL(url);
    throw error;
  }
}

let libheifWorker: Worker | undefined;
let libheifReady: Promise<void> | undefined;
const pendingDecodes = new Map<
  string,
  {
    resolve: (message: Extract<WorkerMessage, { type: "success" }>) => void;
    reject: (error: Error) => void;
  }
>();

function stopLibheifWorker(worker: Worker, error: Error) {
  for (const pending of pendingDecodes.values()) pending.reject(error);
  pendingDecodes.clear();
  worker.terminate();
  if (libheifWorker === worker) {
    libheifWorker = undefined;
    libheifReady = undefined;
  }
}

async function ensureLibheifWorker() {
  if (!libheifWorker) {
    const worker = new Worker(new URL("./libheif-primary.worker.ts", import.meta.url), {
      type: "module",
    });
    libheifWorker = worker;
    libheifReady = new Promise<void>((resolve, reject) => {
      worker.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (message.type === "ready") {
          resolve();
          return;
        }
        if (message.type === "startup-error") {
          reject(new Error(message.message));
          return;
        }
        const pending = pendingDecodes.get(message.id);
        if (!pending) return;
        pendingDecodes.delete(message.id);
        if (message.type === "success") {
          pending.resolve(message);
        } else if (message.code === "dimensions_too_large") {
          pending.reject(new TaskPhotoConversionError(message.message));
        } else {
          pending.reject(new Error(message.message));
        }
      });
      worker.addEventListener("error", (event) => {
        const error = new Error(event.message || "libheif-js worker error");
        reject(error);
        stopLibheifWorker(worker, error);
      });
    });
  }

  const worker = libheifWorker;
  const ready = libheifReady;
  if (!worker || !ready) throw new Error("libheif-js workerを初期化できませんでした");
  try {
    await ready;
    return worker;
  } catch (error) {
    stopLibheifWorker(worker, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

async function decodeWithLibheif(buffer: ArrayBuffer): Promise<DecodedPhoto> {
  const worker = await ensureLibheifWorker();
  const id = crypto.randomUUID();
  const result = await new Promise<Extract<WorkerMessage, { type: "success" }>>(
    (resolve, reject) => {
      pendingDecodes.set(id, { resolve, reject });
      try {
        worker.postMessage({ type: "decode", id, buffer }, [buffer]);
      } catch (error) {
        pendingDecodes.delete(id);
        reject(error);
      }
    },
  );
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
  };
}

async function decodeInput(buffer: ArrayBuffer, kind: InputKind): Promise<DecodedPhoto> {
  try {
    return await decodeWithImageElement(new Blob([buffer], { type: mimeFor(kind) }));
  } catch (standardError) {
    if (kind !== "heic" && kind !== "heif") throw standardError;
  }
  return decodeWithLibheif(buffer);
}

// タスク写真専用。Canvasへ描画し、元画像のEXIF・位置情報を引き継がない。
export async function convertTaskPhoto(file: File): Promise<Blob> {
  if (!file.size || file.size > MAX_INPUT_BYTES) {
    throw new TaskPhotoConversionError("20MB以下の空でない写真を選んでください。");
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new TaskPhotoConversionError("写真を読み取れませんでした。写真を選び直してください。");
  }
  const kind = detectInputKind(buffer);

  let decoded: DecodedPhoto;
  try {
    decoded = await decodeInput(buffer, kind);
  } catch (error) {
    if (error instanceof TaskPhotoConversionError) throw error;
    throw new TaskPhotoConversionError(
      "写真を変換できませんでした。再試行するか選び直してください。",
      true,
    );
  }

  const canvas = document.createElement("canvas");
  try {
    const { width, height } = decoded;
    if (
      !width ||
      !height ||
      width * height > MAX_INPUT_PIXELS ||
      Math.max(width, height) > MAX_INPUT_LONG_EDGE
    ) {
      throw new TaskPhotoConversionError("写真の寸法が大きすぎます。小さい写真を選んでください。");
    }
    const scale = Math.min(1, 1920 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("JPEG encoding failed"))),
        "image/jpeg",
        0.82,
      );
    });
    if (jpeg.type !== "image/jpeg" || !jpeg.size) throw new Error("Invalid JPEG output");
    if (jpeg.size > MAX_OUTPUT_BYTES) {
      throw new TaskPhotoConversionError(
        "変換後の写真が3MiBを超えました。別の写真を選んでください。",
      );
    }
    const verified = await decodeWithImageElement(jpeg);
    const valid = verified.width === canvas.width && verified.height === canvas.height;
    verified.release();
    if (!valid) throw new Error("Invalid JPEG dimensions");
    return jpeg;
  } catch (error) {
    if (error instanceof TaskPhotoConversionError) throw error;
    throw new TaskPhotoConversionError(
      "写真を変換できませんでした。再試行するか選び直してください。",
      true,
    );
  } finally {
    decoded.release();
    canvas.width = 0;
    canvas.height = 0;
  }
}
