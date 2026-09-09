export const TASK_PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";
export const TASK_PHOTO_LIMIT = 8;
const MAX_INPUT_BYTES = 20_000_000;
const MAX_OUTPUT_BYTES = 3 * 1024 * 1024;

const inputTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export class TaskPhotoConversionError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.retryable = retryable;
  }
}

async function decodePhoto(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// タスク写真専用。Canvasへ描画し、元画像のEXIF・位置情報を引き継がない。
export async function convertTaskPhoto(file: File): Promise<Blob> {
  const type = file.type.toLowerCase();
  if (type ? !inputTypes.has(type) : !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new TaskPhotoConversionError("JPEG・PNG・WebP・HEIC／HEIFの写真を選んでください。");
  }
  if (!file.size || file.size > MAX_INPUT_BYTES) {
    throw new TaskPhotoConversionError("20MB以下の空でない写真を選んでください。");
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new TaskPhotoConversionError("写真を読み取れませんでした。写真を選び直してください。");
  }

  let image: HTMLImageElement;
  try {
    image = await decodePhoto(new Blob([buffer], { type }));
  } catch {
    if (/^image\/hei[cf]$/.test(type) || (!type && /\.hei[cf]$/i.test(file.name))) {
      // #102: 安全な配布版・ライセンス対応の承認まではHEIC依存を追加しない。
      throw new TaskPhotoConversionError(
        "この写真は現在のブラウザでは読み込めません。JPEGに変換した写真を選んでください。",
      );
    }
    throw new TaskPhotoConversionError(
      "写真を変換できませんでした。再試行するか選び直してください。",
      true,
    );
  }

  const canvas = document.createElement("canvas");
  try {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height || width * height > 50_000_000 || Math.max(width, height) > 12_000) {
      throw new TaskPhotoConversionError("写真の寸法が大きすぎます。小さい写真を選んでください。");
    }
    const scale = Math.min(1, 1920 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
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
    const verified = await decodePhoto(jpeg);
    const valid =
      verified.naturalWidth === canvas.width && verified.naturalHeight === canvas.height;
    verified.src = "";
    if (!valid) throw new Error("Invalid JPEG dimensions");
    return jpeg;
  } catch (error) {
    if (error instanceof TaskPhotoConversionError) throw error;
    throw new TaskPhotoConversionError(
      "写真を変換できませんでした。再試行するか選び直してください。",
      true,
    );
  } finally {
    image.src = "";
    canvas.width = 0;
    canvas.height = 0;
  }
}
