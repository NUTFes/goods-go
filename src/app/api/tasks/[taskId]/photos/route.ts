import { NextResponse, type NextRequest } from "next/server";
import {
  taskPhotoChangesSchema,
  type TaskPhotoChanges,
  type TaskPhotoErrorCode,
} from "@/features/task-photos/model/api";
import {
  TASK_PHOTO_MAX_BYTES,
  TASK_PHOTO_MIME_TYPE,
} from "@/features/task-photos/model/constraints";
import { InvalidTaskPhotoError, validateTaskPhotoJpeg } from "@/features/task-photos/model/jpeg";
import { getTaskPhotoBucket, taskPhotoObjectKey } from "@/features/task-photos/server/storage";
import { listActiveTaskPhotos } from "@/features/task-photos/server/queries";
import { getCurrentUserProfile } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import type { Tables } from "@/types/schema.gen";

export const runtime = "nodejs";
export const maxDuration = 90;
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 26 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

type TaskPhotoRow = Tables<"task_photos">;

type ValidatedUpload = {
  photoId: string;
  objectKey: string;
  bytes: Uint8Array;
  width: number;
  height: number;
};

function errorResponse(code: TaskPhotoErrorCode, message: string, status: number) {
  return NextResponse.json({ code, message }, { status });
}

function parseContentLength(request: NextRequest): number | null {
  const value = request.headers.get("content-length");
  if (!value || !/^[1-9][0-9]*$/.test(value)) {
    return null;
  }

  const length = Number(value);
  return Number.isSafeInteger(length) ? length : null;
}

function parseChanges(value: FormDataEntryValue | null): TaskPhotoChanges | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const result = taskPhotoChangesSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function validateMultipartFields(
  formData: FormData,
  changes: TaskPhotoChanges,
): Map<string, File> | null {
  if (formData.getAll("changes").length !== 1) {
    return null;
  }

  const expectedFileFields = new Set(changes.additions.map(({ photoId }) => `photo:${photoId}`));
  const files = new Map<string, File>();

  for (const [fieldName, value] of formData.entries()) {
    if (fieldName === "changes") {
      continue;
    }

    if (!expectedFileFields.has(fieldName) || !(value instanceof File) || files.has(fieldName)) {
      return null;
    }
    files.set(fieldName, value);
  }

  return files.size === expectedFileFields.size ? files : null;
}

async function cleanupUploadedObjects(objectKeys: string[]): Promise<void> {
  if (objectKeys.length === 0) {
    return;
  }

  try {
    const bucket = await getTaskPhotoBucket();
    const { error } = await bucket.remove(objectKeys);
    if (error) {
      console.error("Failed to clean up task photo objects", { message: error.message });
    }
  } catch (error) {
    console.error("Failed to initialize Storage during task photo cleanup", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

function databaseErrorResponse(message: string) {
  const knownErrors: Record<string, { code: TaskPhotoErrorCode; message: string; status: number }> =
    {
      task_not_found: {
        code: "task_not_found",
        message: "対象タスクが見つかりません",
        status: 404,
      },
      photo_not_found: {
        code: "photo_not_found",
        message: "対象写真が見つかりません",
        status: 404,
      },
      task_completed: {
        code: "task_completed",
        message: "完了したタスクの写真は変更できません",
        status: 409,
      },
      photo_limit_exceeded: {
        code: "photo_limit_exceeded",
        message: "写真は8枚まで登録できます",
        status: 409,
      },
      photo_conflict: {
        code: "photo_conflict",
        message: "写真の登録状態が変更されています",
        status: 409,
      },
      invalid_request: {
        code: "invalid_request",
        message: "写真の変更内容が不正です",
        status: 400,
      },
      permission_denied: {
        code: "unauthorized",
        message: "写真を変更する権限がありません",
        status: 401,
      },
    };
  const knownError = knownErrors[message];
  return knownError
    ? errorResponse(knownError.code, knownError.message, knownError.status)
    : errorResponse("database_error", "写真情報の保存に失敗しました", 500);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const contentLength = parseContentLength(request);
  if (contentLength === null) {
    return errorResponse("invalid_request", "Content-Lengthが必要です", 411);
  }
  if (contentLength > MAX_REQUEST_BYTES) {
    return errorResponse("invalid_request", "リクエストサイズが26MiBを超えています", 413);
  }

  const currentUser = await getCurrentUserProfile();
  if (!currentUser) {
    return errorResponse("unauthorized", "認証が必要です", 401);
  }

  const { taskId } = await context.params;
  if (!UUID_PATTERN.test(taskId)) {
    return errorResponse("task_not_found", "対象タスクが見つかりません", 404);
  }
  const normalizedTaskId = taskId.toLowerCase();

  const serviceClient = getServiceClient();
  const { data: task, error: taskError } = await serviceClient
    .from("tasks")
    .select("task_id,current_status")
    .eq("task_id", normalizedTaskId)
    .is("deleted", null)
    .maybeSingle();

  if (taskError) {
    return errorResponse("database_error", "タスクの確認に失敗しました", 500);
  }
  if (!task) {
    return errorResponse("task_not_found", "対象タスクが見つかりません", 404);
  }
  if (task.current_status === 3) {
    return errorResponse("task_completed", "完了したタスクの写真は変更できません", 409);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("invalid_request", "multipart/form-dataが不正です", 400);
  }

  const changes = parseChanges(formData.get("changes"));
  if (!changes) {
    return errorResponse("invalid_request", "changesが不正です", 400);
  }

  const files = validateMultipartFields(formData, changes);
  if (!files) {
    return errorResponse("invalid_request", "写真ファイルに欠落・重複・余剰があります", 400);
  }

  const referencedPhotoIds = [
    ...changes.additions.map(({ photoId }) => photoId),
    ...changes.deletedPhotoIds,
  ];
  const existingRows = new Map<string, TaskPhotoRow>();

  if (referencedPhotoIds.length > 0) {
    const { data, error } = await serviceClient
      .from("task_photos")
      .select(
        "photo_id,task_id,sort_order,width,height,created_by_user_id,created_at,deleted_by_user_id,deleted_at",
      )
      .in("photo_id", referencedPhotoIds);

    if (error) {
      return errorResponse("database_error", "写真情報の確認に失敗しました", 500);
    }
    for (const row of data ?? []) {
      existingRows.set(row.photo_id, row as TaskPhotoRow);
    }
  }

  for (const { photoId } of changes.additions) {
    const existing = existingRows.get(photoId);
    if (existing && (existing.task_id !== normalizedTaskId || existing.deleted_at !== null)) {
      return errorResponse("photo_conflict", "写真IDがすでに使用されています", 409);
    }
  }
  for (const photoId of changes.deletedPhotoIds) {
    const existing = existingRows.get(photoId);
    if (!existing) {
      return errorResponse("photo_not_found", "対象写真が見つかりません", 404);
    }
    if (existing.task_id !== normalizedTaskId) {
      return errorResponse("photo_conflict", "別のタスクの写真は削除できません", 409);
    }
  }

  const validatedUploads: ValidatedUpload[] = [];
  for (const { photoId } of changes.additions) {
    if (existingRows.has(photoId)) {
      continue;
    }

    const file = files.get(`photo:${photoId}`);
    if (!file || file.type !== TASK_PHOTO_MIME_TYPE || file.size > TASK_PHOTO_MAX_BYTES) {
      return errorResponse("invalid_image", "JPEG画像が不正です", 422);
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { width, height } = validateTaskPhotoJpeg(bytes);
      validatedUploads.push({
        photoId,
        objectKey: taskPhotoObjectKey(normalizedTaskId, photoId),
        bytes,
        width,
        height,
      });
    } catch (error) {
      if (error instanceof InvalidTaskPhotoError) {
        return errorResponse("invalid_image", "JPEG画像が不正です", 422);
      }
      return errorResponse("invalid_request", "写真ファイルを読み取れません", 400);
    }
  }

  let bucket: Awaited<ReturnType<typeof getTaskPhotoBucket>>;
  try {
    bucket = await getTaskPhotoBucket();
  } catch {
    return errorResponse("storage_error", "写真保存先の初期化に失敗しました", 500);
  }

  const uploadedObjectKeys: string[] = [];
  for (const upload of validatedUploads) {
    const { error } = await bucket.upload(upload.objectKey, upload.bytes, {
      contentType: TASK_PHOTO_MIME_TYPE,
      upsert: true,
    });
    if (error) {
      await cleanupUploadedObjects(uploadedObjectKeys);
      return errorResponse("storage_error", "写真ファイルの保存に失敗しました", 500);
    }
    uploadedObjectKeys.push(upload.objectKey);
  }

  const dimensionsByPhotoId = new Map(
    validatedUploads.map(({ photoId, width, height }) => [photoId, { width, height }]),
  );
  const additions = changes.additions.map(({ photoId }) => {
    const existing = existingRows.get(photoId);
    const dimensions = dimensionsByPhotoId.get(photoId);
    return {
      photo_id: photoId,
      width: existing?.width ?? dimensions?.width ?? 0,
      height: existing?.height ?? dimensions?.height ?? 0,
    };
  });

  const { error: applyError } = await serviceClient.rpc("apply_task_photo_changes", {
    p_task_id: normalizedTaskId,
    p_actor_user_id: currentUser.userId,
    p_additions: additions,
    p_delete_photo_ids: changes.deletedPhotoIds,
  });

  if (applyError) {
    await cleanupUploadedObjects(uploadedObjectKeys);
    return databaseErrorResponse(applyError.message);
  }

  try {
    return NextResponse.json({ photos: await listActiveTaskPhotos(normalizedTaskId) });
  } catch {
    return errorResponse("database_error", "保存後の写真情報を取得できませんでした", 500);
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) {
    return errorResponse("unauthorized", "認証が必要です", 401);
  }

  const { taskId } = await context.params;
  if (!UUID_PATTERN.test(taskId)) {
    return errorResponse("task_not_found", "対象タスクが見つかりません", 404);
  }
  const normalizedTaskId = taskId.toLowerCase();
  const { data: task, error } = await getServiceClient()
    .from("tasks")
    .select("task_id")
    .eq("task_id", normalizedTaskId)
    .is("deleted", null)
    .maybeSingle();

  if (error) {
    return errorResponse("database_error", "タスクの確認に失敗しました", 500);
  }
  if (!task) {
    return errorResponse("task_not_found", "対象タスクが見つかりません", 404);
  }

  try {
    return NextResponse.json(
      { photos: await listActiveTaskPhotos(normalizedTaskId) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return errorResponse("database_error", "写真情報の取得に失敗しました", 500);
  }
}
