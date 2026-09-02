import { z } from "zod";

const uuidSchema = z.uuid();

export const taskPhotoChangesSchema = z
  .object({
    additions: z.array(z.object({ photoId: uuidSchema }).strict()).max(8),
    deletedPhotoIds: z.array(uuidSchema).max(8),
  })
  .strict()
  .superRefine((changes, context) => {
    const additionIds = changes.additions.map(({ photoId }) => photoId);
    if (new Set(additionIds).size !== additionIds.length) {
      context.addIssue({ code: "custom", message: "Duplicate addition photo IDs" });
    }

    if (new Set(changes.deletedPhotoIds).size !== changes.deletedPhotoIds.length) {
      context.addIssue({ code: "custom", message: "Duplicate deletion photo IDs" });
    }

    const deletedIds = new Set(changes.deletedPhotoIds);
    if (additionIds.some((photoId) => deletedIds.has(photoId))) {
      context.addIssue({ code: "custom", message: "A photo cannot be added and deleted together" });
    }
  });

export type TaskPhotoChanges = z.infer<typeof taskPhotoChangesSchema>;

export type PhotoMetadata = {
  photoId: string;
  sortOrder: number;
  width: number;
  height: number;
  createdAt: string;
};

export type TaskPhotoErrorCode =
  | "unauthorized"
  | "invalid_request"
  | "invalid_image"
  | "task_not_found"
  | "photo_not_found"
  | "task_completed"
  | "photo_limit_exceeded"
  | "photo_conflict"
  | "storage_error"
  | "database_error";
