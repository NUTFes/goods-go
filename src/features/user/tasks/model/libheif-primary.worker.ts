/// <reference lib="webworker" />

import libheif from "libheif-js/wasm-bundle";

type DecodeRequest = {
  type: "decode";
  id: string;
  buffer: ArrayBuffer;
};

type WorkerErrorCode = "decode_failed" | "dimensions_too_large";

class WorkerDecodeError extends Error {
  constructor(
    readonly code: WorkerErrorCode,
    message: string,
  ) {
    super(message);
  }
}

type HeifImage = ReturnType<InstanceType<typeof libheif.HeifDecoder>["decode"]>[number];
const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const MAX_PIXELS = 16_000_000;
const MAX_LONG_EDGE = 12_000;

function validateDimensions(width: number, height: number) {
  const pixels = width * height;
  if (
    width <= 0 ||
    height <= 0 ||
    !Number.isSafeInteger(pixels) ||
    pixels > MAX_PIXELS ||
    Math.max(width, height) > MAX_LONG_EDGE
  ) {
    throw new WorkerDecodeError(
      "dimensions_too_large",
      "HEIC／HEIFは16MP以下の写真を選んでください。",
    );
  }
}

function renderImage(image: HeifImage) {
  const imageData = new ImageData(image.get_width(), image.get_height());
  for (let offset = 3; offset < imageData.data.length; offset += 4) {
    imageData.data[offset] = 255;
  }
  return new Promise<ImageData>((resolve, reject) => {
    image.display(imageData, (result) =>
      result ? resolve(result) : reject(new Error("HEIF processing error")),
    );
  });
}

async function decodePrimary(buffer: ArrayBuffer) {
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(buffer);
  let primaryImage: HeifImage | undefined;

  try {
    if (!images.length) throw new Error("HEIF image not found");
    if (decoder.decoder) {
      try {
        const primaryHandle = libheif.heif_js_context_get_primary_image_handle(decoder.decoder);
        primaryImage = new libheif.HeifImage(primaryHandle);
      } catch {
        // primary itemを取得できない画像ではtop-level画像の先頭を使う。
      }
    }

    const selected = primaryImage ?? images[0];
    validateDimensions(selected.get_width(), selected.get_height());
    const imageData = await renderImage(selected);
    const rgbaBuffer = imageData.data.buffer;
    if (!(rgbaBuffer instanceof ArrayBuffer)) throw new Error("Invalid HEIF pixel buffer");
    return { width: imageData.width, height: imageData.height, rgbaBuffer };
  } finally {
    primaryImage?.free();
    for (const image of images) image.free();
    if (decoder.decoder) {
      libheif.heif_context_free(decoder.decoder);
      decoder.decoder = null;
    }
  }
}

workerScope.addEventListener("message", async (event: MessageEvent<DecodeRequest>) => {
  if (event.data.type !== "decode") return;
  try {
    const result = await decodePrimary(event.data.buffer);
    workerScope.postMessage({ type: "success", id: event.data.id, ...result }, [result.rgbaBuffer]);
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      id: event.data.id,
      code: error instanceof WorkerDecodeError ? error.code : "decode_failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

Promise.resolve(libheif.ready)
  .then(() => workerScope.postMessage({ type: "ready" }))
  .catch((error) =>
    workerScope.postMessage({
      type: "startup-error",
      message: error instanceof Error ? error.message : String(error),
    }),
  );
