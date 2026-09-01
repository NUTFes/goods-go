/// <reference lib="webworker" />

import libheif from "libheif-js/wasm-bundle";

type DecodeRequest = {
  type: "decode";
  id: string;
  buffer: ArrayBuffer;
};

type HeifImage = ReturnType<InstanceType<typeof libheif.HeifDecoder>["decode"]>[number];

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function renderImage(image: HeifImage): Promise<ImageData> {
  const width = image.get_width();
  const height = image.get_height();
  const imageData = new ImageData(width, height);

  for (let offset = 3; offset < imageData.data.length; offset += 4) {
    imageData.data[offset] = 255;
  }

  return new Promise<ImageData>((resolve, reject) => {
    image.display(imageData, (result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error("HEIF processing error"));
      }
    });
  });
}

async function decodePrimary(buffer: ArrayBuffer) {
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(buffer);
  let primaryImage: HeifImage | undefined;

  try {
    if (images.length === 0) {
      throw new Error("HEIF image not found");
    }

    if (decoder.decoder) {
      try {
        const primaryHandle = libheif.heif_js_context_get_primary_image_handle(decoder.decoder);
        primaryImage = new libheif.HeifImage(primaryHandle);
      } catch {
        // primary itemを取得できないfixtureではtop-level画像の先頭へfallbackする。
      }
    }

    const selectedImage = primaryImage ?? images[0];
    const imageData = await renderImage(selectedImage);
    const rgbaBuffer = imageData.data.slice().buffer;

    return {
      width: imageData.width,
      height: imageData.height,
      rgbaBuffer,
      imageCount: images.length,
      selectedPrimary: primaryImage !== undefined,
    };
  } finally {
    primaryImage?.free();
    for (const image of images) {
      image.free();
    }
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
      message: errorMessage(error),
    });
  }
});

Promise.resolve(libheif.ready)
  .then(() => workerScope.postMessage({ type: "ready" }))
  .catch((error) =>
    workerScope.postMessage({ type: "startup-error", message: errorMessage(error) }),
  );
