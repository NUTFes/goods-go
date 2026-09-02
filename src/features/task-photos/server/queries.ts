import "server-only";

import type { PhotoMetadata } from "@/features/task-photos/model/api";
import { getServiceClient } from "@/lib/supabase/service";

export async function listActiveTaskPhotos(taskId: string): Promise<PhotoMetadata[]> {
  const { data, error } = await getServiceClient()
    .from("task_photos")
    .select("photo_id,sort_order,width,height,created_at")
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error("Failed to load task photos", { cause: error });
  }

  return (data ?? []).map((row) => ({
    photoId: row.photo_id,
    sortOrder: row.sort_order,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  }));
}
