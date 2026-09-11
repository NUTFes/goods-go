import assert from "node:assert/strict";
import { test } from "node:test";
import {
  convertTaskPhoto,
  TaskPhotoConversionError,
} from "../src/features/user/tasks/model/convert-task-photo.ts";
import { loadTaskPhotos, uploadTaskPhotos } from "../src/features/user/tasks/model/task-photos.ts";

test("対象外形式・空ファイル・20MB超はデコードせず拒否する", async () => {
  for (const type of ["image/avif", "image/gif", "image/svg+xml", "video/mp4"]) {
    await assert.rejects(convertTaskPhoto(new File(["x"], "photo.jpg", { type })), /JPEG/);
  }
  await assert.rejects(convertTaskPhoto(new File([], "empty.jpg", { type: "image/jpeg" })), /20MB/);
  await assert.rejects(
    convertTaskPhoto({ name: "large.jpg", type: "image/jpeg", size: 20_000_001 }),
    /20MB/,
  );
});

test("読み取り不能は同じFileを再試行しない", async () => {
  let reads = 0;
  const file = {
    name: "photo.heic",
    type: "image/heic",
    size: 10,
    arrayBuffer() {
      reads++;
      throw new DOMException("unreadable", "NotReadableError");
    },
  };
  await assert.rejects(convertTaskPhoto(file), (error) => {
    assert.equal(error.retryable, false);
    assert.match(error.message, /選び直し/);
    return true;
  });
  assert.equal(reads, 1);
});

function canvasEnvironment(
  t,
  {
    width = 4032,
    height = 3024,
    outputSize = 20,
    outputType = "image/jpeg",
    decodeFails = false,
  } = {},
) {
  const urls = new Map();
  const images = [];
  let next = 0;
  let requested;
  const canvas = {
    width: 0,
    height: 0,
    getContext() {
      return { fillStyle: "", fillRect() {}, drawImage() {} };
    },
    toBlob(callback, type, quality) {
      requested = { type, quality, width: canvas.width, height: canvas.height };
      callback(new Blob([new Uint8Array(outputSize)], { type: outputType }));
    },
  };
  t.mock.method(URL, "createObjectURL", (blob) => {
    const url = `blob:test-${next++}`;
    urls.set(url, blob);
    return url;
  });
  t.mock.method(URL, "revokeObjectURL", (url) => urls.delete(url));
  const oldImage = globalThis.Image;
  const oldDocument = globalThis.document;
  globalThis.Image = class {
    src = "";
    constructor() {
      images.push(this);
    }
    async decode() {
      if (decodeFails) throw new DOMException("Invalid image", "EncodingError");
      assert.ok(urls.has(this.src));
      this.naturalWidth = requested?.width ?? width;
      this.naturalHeight = requested?.height ?? height;
    }
  };
  globalThis.document = { createElement: () => canvas };
  t.after(() => {
    globalThis.Image = oldImage;
    globalThis.document = oldDocument;
  });
  return { canvas, urls, images, requested: () => requested };
}

test("長辺1920・品質82%のJPEGだけを生成し、再検証後に画像リソースを解放する", async (t) => {
  const env = canvasEnvironment(t);
  const result = await convertTaskPhoto(new File(["input"], "photo.png", { type: "image/png" }));
  assert.equal(result.type, "image/jpeg");
  assert.deepEqual(env.requested(), {
    type: "image/jpeg",
    quality: 0.82,
    width: 1920,
    height: 1440,
  });
  assert.equal(env.images.length, 2);
  assert.ok(env.images.every((image) => image.src === ""));
  assert.equal(env.urls.size, 0);
  assert.equal(env.canvas.width, 0);
});

test("小さい写真は拡大しない", async (t) => {
  const env = canvasEnvironment(t, { width: 320, height: 240 });
  await convertTaskPhoto(new File(["input"], "photo.webp", { type: "image/webp" }));
  assert.equal(env.requested().width, 320);
  assert.equal(env.requested().height, 240);
});

test("50MP超はCanvasへの全面描画前に拒否する", async (t) => {
  const env = canvasEnvironment(t, { width: 8400, height: 6000 });
  await assert.rejects(convertTaskPhoto(new File(["input"], "photo.jpg")), /寸法/);
  assert.equal(env.requested(), undefined);
  assert.equal(env.urls.size, 0);
  assert.equal(env.images[0].src, "");
});

test("3MiB超は品質を変更して再圧縮せず拒否する", async (t) => {
  const env = canvasEnvironment(t, { outputSize: 3 * 1024 * 1024 + 1 });
  await assert.rejects(convertTaskPhoto(new File(["input"], "photo.jpg")), /3MiB/);
  assert.equal(env.requested().quality, 0.82);
  assert.equal(env.urls.size, 0);
});

test("CanvasがJPEG以外を返した場合は保存に渡さない", async (t) => {
  canvasEnvironment(t, { outputType: "image/png" });
  await assert.rejects(
    convertTaskPhoto(new File(["input"], "photo.jpg")),
    TaskPhotoConversionError,
  );
});

test("標準APIで読めないHEICは、未承認のデコーダーを使わず選び直しを案内する", async (t) => {
  const env = canvasEnvironment(t, { decodeFails: true });
  await assert.rejects(convertTaskPhoto(new File(["input"], "photo.heic")), (error) => {
    assert.equal(error.retryable, false);
    assert.match(error.message, /JPEGに変換/);
    return true;
  });
  assert.equal(env.urls.size, 0);
});

test("uploadは逐次実行し、失敗・重複・403の後も後続を処理する", async () => {
  const responses = [
    null,
    new Error("offline"),
    { statusCode: "Duplicate" },
    { statusCode: "400", message: "The resource already exists" },
    { statusCode: "403", message: "Forbidden" },
    null,
  ];
  const calls = [];
  let active = false;
  const client = {
    storage: {
      from(bucket) {
        assert.equal(bucket, "task-photos");
        return {
          async upload(path, blob, options) {
            assert.equal(active, false);
            active = true;
            await new Promise((resolve) => setImmediate(resolve));
            calls.push({ path, blob, options });
            active = false;
            const result = responses[calls.length - 1];
            if (result instanceof Error) throw result;
            return { error: result };
          },
        };
      },
    },
  };
  const drafts = responses.map((_, index) => ({
    photoId: String(index),
    jpeg: new Blob(["jpeg"], { type: "image/jpeg" }),
  }));
  const failures = await uploadTaskPhotos(client, "task", drafts);
  assert.deepEqual([...failures.keys()], ["1", "4"]);
  assert.equal(calls.length, 6);
  assert.deepEqual(
    calls.map((call) => call.path),
    drafts.map((draft) => `tasks/task/${draft.photoId}.jpg`),
  );
  assert.ok(
    calls.every(
      (call) => call.options.upsert === false && call.options.contentType === "image/jpeg",
    ),
  );
});

test("写真0枚の取得ではsigned URLを発行しない", async () => {
  const client = {
    from(table) {
      const chain = {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        is() {
          return this;
        },
        single: async () => ({ data: { current_status: 3 }, error: null }),
        order: async (column) => {
          assert.equal(column, "sort_order");
          return { data: [], error: null };
        },
      };
      assert.ok(["tasks", "task_photos"].includes(table));
      return chain;
    },
    storage: {
      from() {
        assert.fail("No objects to sign");
      },
    },
  };
  assert.deepEqual(await loadTaskPhotos(client, "task"), { completed: true, photos: [] });
});

test("signed URLの発行失敗は写真取得の失敗として扱う", async () => {
  const client = {
    from(table) {
      const chain = {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        is() {
          return this;
        },
        single: async () => ({ data: { current_status: 0 }, error: null }),
        order: async () => ({
          data: [
            {
              photo_id: "photo-1",
              task_id: "task",
              sort_order: 0,
              created_at: "2026-09-11T00:00:00Z",
              deleted_at: null,
            },
          ],
          error: null,
        }),
      };
      assert.ok(["tasks", "task_photos"].includes(table));
      return chain;
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "task-photos");
        return {
          async createSignedUrls() {
            return { data: null, error: new Error("signing failed") };
          },
        };
      },
    },
  };

  await assert.rejects(loadTaskPhotos(client, "task"), /signing failed/);
});
