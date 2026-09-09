import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/schema.gen";

export type TaskPhoto = Tables<"task_photos"> & { url: string | null };
export type PhotoDraft = {
  photoId: string;
  file: File;
  jpeg?: Blob;
  error?: string;
  retryable?: boolean;
};

export const taskPhotoPath = (taskId: string, photoId: string) => `tasks/${taskId}/${photoId}.jpg`;

export async function loadTaskPhotos(client: SupabaseClient<Database>, taskId: string) {
  const [task, photos] = await Promise.all([
    client
      .from("tasks")
      .select("current_status")
      .eq("task_id", taskId)
      .is("deleted", null)
      .single(),
    client
      .from("task_photos")
      .select("*")
      .eq("task_id", taskId)
      .is("deleted_at", null)
      .order("sort_order"),
  ]);
  if (task.error) throw task.error;
  if (photos.error) throw photos.error;
  const rows = photos.data;
  const signed = rows.length
    ? await client.storage.from("task-photos").createSignedUrls(
        rows.map((photo) => taskPhotoPath(taskId, photo.photo_id)),
        3600,
      )
    : null;
  return {
    completed: task.data.current_status === 3,
    photos: rows.map(
      (row, index): TaskPhoto => ({ ...row, url: signed?.data?.[index]?.signedUrl || null }),
    ),
  };
}

// 個別uploadの失敗で残りの写真を止めない。RPCは呼び出し側が全件成功後に行う。
export async function uploadTaskPhotos(
  client: SupabaseClient<Database>,
  taskId: string,
  drafts: PhotoDraft[],
) {
  const failures = new Map<string, string>();
  for (const draft of drafts) {
    try {
      if (!draft.jpeg) throw new Error("Photo not converted");
      const { error } = await client.storage
        .from("task-photos")
        .upload(taskPhotoPath(taskId, draft.photoId), draft.jpeg, {
          contentType: "image/jpeg",
          upsert: false,
        });
      // upload成功の応答を失っても、同じIDでRPC確定を再試行できる。
      if (error) {
        const duplicate =
          error.statusCode === "Duplicate" ||
          error.statusCode === "ResourceAlreadyExists" ||
          (["400", "409"].includes(error.statusCode ?? "") &&
            error.message === "The resource already exists");
        if (!duplicate) throw error;
      }
    } catch {
      failures.set(
        draft.photoId,
        "写真を送信できませんでした。「写真を保存」で再試行してください。",
      );
    }
  }
  return failures;
}

export function photoSaveMessage(message: string) {
  switch (message) {
    case "task_completed":
      return "タスクが完了したため写真を変更できません。管理者に差し戻しを依頼してください。";
    case "photo_limit_exceeded":
      return "写真が8枚を超えます。最新の写真を確認し、編集し直してください。";
    case "photo_conflict":
    case "photo_not_found":
      return "写真の状態が変わりました。最新の写真を確認し、編集し直してください。";
    case "task_not_found":
      return "タスクが見つかりません。一覧を更新してください。";
    case "permission_denied":
      return "写真を保存する権限を確認できません。ログインし直してください。";
    case "":
      return "保存結果を確認できませんでした。「保存結果を確認」で再試行してください。";
    default:
      return "写真を保存できませんでした。再読み込みして、編集し直してください。";
  }
}
