import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/schema.gen";

export const TASK_PHOTO_BUCKET = "task-photos";
export const TASK_PHOTO_MIME_TYPE = "image/jpeg";
export const TASK_PHOTO_MAX_BYTES = 3 * 1024 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StorageErrorLike = {
  message?: string;
  statusCode?: number | string;
};

let bucketInitialization: Promise<void> | undefined;

function hasStatus(error: StorageErrorLike, status: number): boolean {
  return Number(error.statusCode) === status;
}

function isAlreadyExists(error: StorageErrorLike): boolean {
  return hasStatus(error, 409) || error.message?.toLowerCase().includes("already exists") === true;
}

async function updateBucket(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.storage.updateBucket(TASK_PHOTO_BUCKET, {
    public: false,
    fileSizeLimit: TASK_PHOTO_MAX_BYTES,
    allowedMimeTypes: [TASK_PHOTO_MIME_TYPE],
  });

  if (error) {
    throw new Error("Failed to configure the task photo bucket", { cause: error });
  }
}

async function initializeBucket(): Promise<void> {
  const client = getServiceClient();
  const { data: bucket, error } = await client.storage.getBucket(TASK_PHOTO_BUCKET);

  if (error && !hasStatus(error, 404)) {
    throw new Error("Failed to inspect the task photo bucket", { cause: error });
  }

  if (!bucket) {
    const { error: createError } = await client.storage.createBucket(TASK_PHOTO_BUCKET, {
      public: false,
      fileSizeLimit: TASK_PHOTO_MAX_BYTES,
      allowedMimeTypes: [TASK_PHOTO_MIME_TYPE],
    });

    if (!createError) {
      return;
    }

    // 別プロセスが同時に作成した場合は、既存Bucketを正しい設定へ揃える。
    if (isAlreadyExists(createError)) {
      await updateBucket(client);
      return;
    }

    throw new Error("Failed to create the task photo bucket", { cause: createError });
  }

  const allowedMimeTypes = bucket.allowed_mime_types ?? [];
  const matchesExpectedConfiguration =
    bucket.public === false &&
    Number(bucket.file_size_limit) === TASK_PHOTO_MAX_BYTES &&
    allowedMimeTypes.length === 1 &&
    allowedMimeTypes[0] === TASK_PHOTO_MIME_TYPE;

  if (!matchesExpectedConfiguration) {
    await updateBucket(client);
  }
}

export async function ensureTaskPhotoBucket(): Promise<void> {
  if (!bucketInitialization) {
    bucketInitialization = initializeBucket().catch((error: unknown) => {
      bucketInitialization = undefined;
      throw error;
    });
  }

  await bucketInitialization;
}

function normalizeUuid(value: string, fieldName: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a UUID`);
  }

  return value.toLowerCase();
}

export function taskPhotoObjectKey(taskId: string, photoId: string): string {
  const normalizedTaskId = normalizeUuid(taskId, "taskId");
  const normalizedPhotoId = normalizeUuid(photoId, "photoId");
  return `tasks/${normalizedTaskId}/${normalizedPhotoId}.jpg`;
}

export async function getTaskPhotoBucket() {
  await ensureTaskPhotoBucket();
  return getServiceClient().storage.from(TASK_PHOTO_BUCKET);
}
