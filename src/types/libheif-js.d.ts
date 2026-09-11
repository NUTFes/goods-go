declare module "libheif-js/wasm-bundle" {
  type HeifContext = object;
  type HeifImageHandle = object;

  type HeifImage = {
    display: (imageData: ImageData, callback: (result: ImageData | null) => void) => void;
    free: () => void;
    get_height: () => number;
    get_width: () => number;
  };

  type HeifDecoder = {
    decode: (buffer: ArrayBuffer) => HeifImage[];
    decoder: HeifContext | null;
  };

  const libheif: {
    HeifDecoder: new () => HeifDecoder;
    HeifImage: new (handle: HeifImageHandle) => HeifImage;
    heif_context_free: (context: HeifContext) => void;
    heif_js_context_get_primary_image_handle: (context: HeifContext) => HeifImageHandle;
    ready?: Promise<unknown>;
  };

  export default libheif;
}
