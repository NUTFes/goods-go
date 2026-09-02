import { NextResponse, type NextRequest } from "next/server";
import type { TaskPhotoErrorCode } from "@/features/task-photos/model/api";
import { createTaskPhotoSignedUrl } from "@/features/task-photos/server/storage";
import { getCurrentUserProfile } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ taskId: string; photoId: string }>;
};

function errorResponse(code: TaskPhotoErrorCode, message: string, status: number) {
  return NextResponse.json({ code, message }, { status });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) {
    return errorResponse("unauthorized", "認証が必要です", 401);
  }

  const { taskId, photoId } = await context.params;
  if (!UUID_PATTERN.test(taskId)) {
    return errorResponse("task_not_found", "対象タスクが見つかりません", 404);
  }
  if (!UUID_PATTERN.test(photoId)) {
    return errorResponse("photo_not_found", "対象写真が見つかりません", 404);
  }

  const normalizedTaskId = taskId.toLowerCase();
  const normalizedPhotoId = photoId.toLowerCase();
  const serviceClient = getServiceClient();
  const { data: task, error: taskError } = await serviceClient
    .from("tasks")
    .select("task_id")
    .eq("task_id", normalizedTaskId)
    .is("deleted", null)
    .maybeSingle();

  if (taskError) {
    return errorResponse("database_error", "タスクの確認に失敗しました", 500);
  }
  if (!task) {
    return errorResponse("task_not_found", "対象タスクが見つかりません", 404);
  }

  const { data: photo, error: photoError } = await serviceClient
    .from("task_photos")
    .select("photo_id")
    .eq("photo_id", normalizedPhotoId)
    .eq("task_id", normalizedTaskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (photoError) {
    return errorResponse("database_error", "写真情報の確認に失敗しました", 500);
  }
  if (!photo) {
    return errorResponse("photo_not_found", "対象写真が見つかりません", 404);
  }

  const issuedAt = Date.now();
  try {
    const url = await createTaskPhotoSignedUrl(
      normalizedTaskId,
      normalizedPhotoId,
      SIGNED_URL_TTL_SECONDS,
    );
    return NextResponse.json(
      {
        url,
        expiresAt: new Date(issuedAt + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return errorResponse("storage_error", "写真の表示URLを発行できませんでした", 500);
  }
}
