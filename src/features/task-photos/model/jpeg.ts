import { TASK_PHOTO_MAX_BYTES, TASK_PHOTO_MAX_EDGE, TASK_PHOTO_MAX_PIXELS } from "./constraints.ts";

const START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

export type JpegDimensions = {
  width: number;
  height: number;
};

export class InvalidTaskPhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTaskPhotoError";
  }
}

function invalid(message: string): never {
  throw new InvalidTaskPhotoError(message);
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readJpegDimensions(bytes: Uint8Array): JpegDimensions {
  let offset = 2;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      invalid("JPEG marker is missing");
    }

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }

    if (offset >= bytes.length) {
      invalid("JPEG marker is truncated");
    }

    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 2 > bytes.length) {
      invalid("JPEG segment length is missing");
    }

    const segmentLength = readUint16(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      invalid("JPEG segment is truncated");
    }

    if (START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 8) {
        invalid("JPEG frame header is truncated");
      }

      const height = readUint16(bytes, offset + 3);
      const width = readUint16(bytes, offset + 5);

      if (width < 1 || height < 1) {
        invalid("JPEG dimensions must be positive");
      }

      return { width, height };
    }

    offset += segmentLength;
  }

  return invalid("JPEG frame header was not found");
}

export function validateTaskPhotoJpeg(bytes: Uint8Array): JpegDimensions {
  if (bytes.byteLength > TASK_PHOTO_MAX_BYTES) {
    invalid("JPEG exceeds the 3 MiB limit");
  }

  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    invalid("JPEG signature is invalid");
  }

  const dimensions = readJpegDimensions(bytes);
  if (dimensions.width > TASK_PHOTO_MAX_EDGE || dimensions.height > TASK_PHOTO_MAX_EDGE) {
    invalid("JPEG edge exceeds 1920 pixels");
  }

  if (dimensions.width * dimensions.height > TASK_PHOTO_MAX_PIXELS) {
    invalid("JPEG pixel count exceeds the limit");
  }

  return dimensions;
}
