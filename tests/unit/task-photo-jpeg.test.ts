import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TASK_PHOTO_MAX_BYTES,
  TASK_PHOTO_MAX_PIXELS,
} from "../../src/features/task-photos/model/constraints.ts";
import {
  InvalidTaskPhotoError,
  validateTaskPhotoJpeg,
} from "../../src/features/task-photos/model/jpeg.ts";

function jpegWithDimensions(width: number, height: number, marker = 0xc0): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    marker,
    0x00,
    0x08,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
  ]);
}

describe("validateTaskPhotoJpeg", () => {
  it("baseline JPEGの寸法を実データから取得する", () => {
    assert.deepEqual(validateTaskPhotoJpeg(jpegWithDimensions(1920, 1080)), {
      width: 1920,
      height: 1080,
    });
  });

  it("progressive JPEGのSOF markerを認識する", () => {
    assert.deepEqual(validateTaskPhotoJpeg(jpegWithDimensions(1280, 720, 0xc2)), {
      width: 1280,
      height: 720,
    });
  });

  it("3MiBを超える入力を拒否する", () => {
    const oversized = new Uint8Array(TASK_PHOTO_MAX_BYTES + 1);
    oversized.set(jpegWithDimensions(1, 1));
    assert.throws(() => validateTaskPhotoJpeg(oversized), InvalidTaskPhotoError);
  });

  it("JPEG以外のmagic bytesを拒否する", () => {
    assert.throws(
      () => validateTaskPhotoJpeg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])),
      InvalidTaskPhotoError,
    );
  });

  it("SOFがないJPEGを拒否する", () => {
    assert.throws(
      () => validateTaskPhotoJpeg(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])),
      InvalidTaskPhotoError,
    );
  });

  it("切れたsegmentを拒否する", () => {
    assert.throws(
      () => validateTaskPhotoJpeg(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])),
      InvalidTaskPhotoError,
    );
  });

  it("1920pxを超える辺を拒否する", () => {
    assert.throws(
      () => validateTaskPhotoJpeg(jpegWithDimensions(1921, 1080)),
      InvalidTaskPhotoError,
    );
  });

  it("0pxの寸法を拒否する", () => {
    assert.throws(() => validateTaskPhotoJpeg(jpegWithDimensions(0, 1080)), InvalidTaskPhotoError);
  });

  it("最大画素数の境界を許可する", () => {
    const dimensions = validateTaskPhotoJpeg(jpegWithDimensions(1920, 1920));
    assert.equal(dimensions.width * dimensions.height, TASK_PHOTO_MAX_PIXELS);
  });
});
