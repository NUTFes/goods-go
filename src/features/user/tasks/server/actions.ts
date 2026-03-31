"use server";

import { revalidatePath } from "next/cache";
import { APP_ROLES } from "@/lib/auth/roles";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { TASK_NOTE_MAX_LENGTH, type ActionResult, type TaskStatus } from "../model/types";

function isTaskStatus(value: number): value is TaskStatus {
  return value === 0 || value === 1 || value === 2;
}

export async function updateTaskStatusAction(
  taskId: string,
  status: number,
  note?: string,
): Promise<ActionResult> {
  const currentUser = await requireAuthenticatedUser();

  if (currentUser.role !== APP_ROLES.ADMIN && currentUser.role !== APP_ROLES.LEADER) {
    return { ok: false, message: "ステータスを変更する権限がありません" };
  }

  if (!taskId) {
    return { ok: false, message: "対象タスクが見つかりません" };
  }

  if (!isTaskStatus(status)) {
    return { ok: false, message: "不正なステータスです" };
  }

  const isAdmin = currentUser.role === APP_ROLES.ADMIN;
  if (note !== undefined && !isAdmin) {
    return { ok: false, message: "備考を変更する権限がありません" };
  }

  const normalizedNote = note?.trim() ?? "";
  if (note !== undefined && normalizedNote.length > TASK_NOTE_MAX_LENGTH) {
    return { ok: false, message: `備考は${TASK_NOTE_MAX_LENGTH}文字以内で入力してください` };
  }

  const updatePayload: { current_status: TaskStatus; note?: string | null } = {
    current_status: status,
  };
  if (note !== undefined) {
    updatePayload.note = normalizedNote.length > 0 ? normalizedNote : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .select("task_id")
    .eq("task_id", taskId)
    .is("deleted", null)
    .maybeSingle();

  if (error) {
    return { ok: false, message: "ステータスの更新に失敗しました" };
  }
  if (!data) {
    return { ok: false, message: "対象タスクが見つかりません" };
  }

  revalidatePath("/tasks");
  return { ok: true };
}
