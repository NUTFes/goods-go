import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { taskPhotoChangesSchema } from "../../src/features/task-photos/model/api.ts";

const PHOTO_ID_1 = "40000000-0000-4000-8000-000000000001";
const PHOTO_ID_2 = "40000000-0000-4000-8000-000000000002";

describe("taskPhotoChangesSchema", () => {
  it("追加順と削除対象を受け付ける", () => {
    const result = taskPhotoChangesSchema.safeParse({
      additions: [{ photoId: PHOTO_ID_1 }],
      deletedPhotoIds: [PHOTO_ID_2],
    });
    assert.equal(result.success, true);
  });

  it("余剰fieldを拒否する", () => {
    const result = taskPhotoChangesSchema.safeParse({
      additions: [],
      deletedPhotoIds: [],
      unexpected: true,
    });
    assert.equal(result.success, false);
  });

  it("追加写真IDの重複を拒否する", () => {
    const result = taskPhotoChangesSchema.safeParse({
      additions: [{ photoId: PHOTO_ID_1 }, { photoId: PHOTO_ID_1 }],
      deletedPhotoIds: [],
    });
    assert.equal(result.success, false);
  });

  it("削除写真IDの重複を拒否する", () => {
    const result = taskPhotoChangesSchema.safeParse({
      additions: [],
      deletedPhotoIds: [PHOTO_ID_1, PHOTO_ID_1],
    });
    assert.equal(result.success, false);
  });

  it("同じ写真の追加と削除を拒否する", () => {
    const result = taskPhotoChangesSchema.safeParse({
      additions: [{ photoId: PHOTO_ID_1 }],
      deletedPhotoIds: [PHOTO_ID_1],
    });
    assert.equal(result.success, false);
  });

  it("UUID以外を拒否する", () => {
    const result = taskPhotoChangesSchema.safeParse({
      additions: [{ photoId: "not-a-uuid" }],
      deletedPhotoIds: [],
    });
    assert.equal(result.success, false);
  });
});
