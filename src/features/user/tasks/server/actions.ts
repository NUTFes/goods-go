"use server";

import { revalidatePath } from "next/cache";
import {
  canChangeTaskStatus,
  isTaskStatus,
  type TaskStatus,
} from "@/features/tasks/model/task-status";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { APP_ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { TASK_NOTE_MAX_LENGTH, type ActionResult } from "../model/types";

const TASK_VERSION_CONFLICT_MESSAGE =
  "ほかの利用者がこのタスクを更新しました。最新の状態を確認して、もう一度操作してください";

export async function updateTaskStatusAction(
  taskId: string,
  status: number,
  expectedLockVersion: number,
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

  if (!Number.isSafeInteger(expectedLockVersion) || expectedLockVersion < 0) {
    return { ok: false, message: "タスクの更新情報が不正です" };
  }

  const isAdmin = currentUser.role === APP_ROLES.ADMIN;
  if (note !== undefined && !isAdmin) {
    return { ok: false, message: "備考を変更する権限がありません" };
  }

  const normalizedNote = note?.trim() ?? "";
  if (note !== undefined && normalizedNote.length > TASK_NOTE_MAX_LENGTH) {
    return { ok: false, message: `備考は${TASK_NOTE_MAX_LENGTH}文字以内で入力してください` };
  }

  const supabase = await createClient();
  const { data: currentTask, error: currentTaskError } = await supabase
    .from("tasks")
    .select("current_status,lock_version")
    .eq("task_id", taskId)
    .is("deleted", null)
    .maybeSingle();

  if (currentTaskError || !currentTask) {
    return { ok: false, message: "対象タスクが見つかりません" };
  }

  if (currentTask.lock_version !== expectedLockVersion) {
    return {
      ok: false,
      code: "task_version_conflict",
      message: TASK_VERSION_CONFLICT_MESSAGE,
    };
  }

  if (!isTaskStatus(currentTask.current_status)) {
    return { ok: false, message: "現在のステータスが不正です" };
  }

  const hasStatusChange = currentTask.current_status !== status;
  if (
    hasStatusChange &&
    !canChangeTaskStatus(currentUser.role, currentTask.current_status, status)
  ) {
    return {
      ok: false,
      message:
        currentTask.current_status === 3
          ? "完了したタスクを差し戻せるのは管理者だけです"
          : "完了に変更できるのは管理者だけです",
    };
  }

  if (!hasStatusChange && note === undefined) {
    return { ok: true };
  }

  const updatePayload: { current_status: TaskStatus; note?: string | null } = {
    current_status: status,
  };
  if (note !== undefined) {
    updatePayload.note = normalizedNote.length > 0 ? normalizedNote : null;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("task_id", taskId)
    .eq("lock_version", expectedLockVersion)
    .is("deleted", null)
    .select("task_id,lock_version")
    .maybeSingle();

  if (error) {
    return { ok: false, message: "ステータスの更新に失敗しました" };
  }
  if (!data) {
    return {
      ok: false,
      code: "task_version_conflict",
      message: TASK_VERSION_CONFLICT_MESSAGE,
    };
  }

  revalidatePath("/tasks");
  return { ok: true };
}
