"use server";

import { refresh, revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { type TaskFormInput, taskFormSchema } from "../model/schema";
import type { ActionResult } from "../model/types";

const TASK_VERSION_CONFLICT_MESSAGE =
  "ほかの利用者がこのタスクを更新しました。最新の状態を確認して、もう一度操作してください";

function normalizeFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
): Record<string, string[]> {
  const normalized: Record<string, string[]> = {};

  for (const [fieldName, messages] of Object.entries(fieldErrors)) {
    if (!messages || messages.length === 0) {
      continue;
    }
    normalized[fieldName] = messages;
  }

  return normalized;
}

function parseTaskInput(input: TaskFormInput): { data: TaskFormInput } | { error: ActionResult } {
  const parsed = taskFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: {
        ok: false,
        fieldErrors: normalizeFieldErrors(parsed.error.flatten().fieldErrors),
      },
    };
  }
  return { data: parsed.data };
}

export async function createTaskAction(input: TaskFormInput): Promise<ActionResult> {
  const currentUser = await requireAdminUser();
  const parsedInput = parseTaskInput(input);

  if ("error" in parsedInput) {
    return parsedInput.error;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    event_day_type: parsedInput.data.eventDayType,
    item_id: parsedInput.data.itemId,
    quantity: parsedInput.data.quantity,
    from_location_id: parsedInput.data.fromLocationId,
    to_location_id: parsedInput.data.toLocationId,
    scheduled_start_time: parsedInput.data.scheduledStartTime,
    scheduled_end_time: parsedInput.data.scheduledEndTime,
    created_user_id: currentUser.userId,
    leader_user_id: parsedInput.data.leaderUserId,
    current_status: parsedInput.data.currentStatus,
    note: parsedInput.data.note?.trim() || null,
  });

  if (error) {
    return { ok: false, message: "タスクの追加に失敗しました" };
  }

  revalidatePath("/admin/tasks");
  refresh();
  return { ok: true };
}

export async function updateTaskAction(
  taskId: string,
  input: TaskFormInput,
  expectedLockVersion: number,
): Promise<ActionResult> {
  await requireAdminUser();

  if (!taskId) {
    return { ok: false, message: "対象タスクが見つかりません" };
  }

  if (!Number.isSafeInteger(expectedLockVersion) || expectedLockVersion < 0) {
    return { ok: false, message: "タスクの更新情報が不正です" };
  }

  const parsedInput = parseTaskInput(input);
  if ("error" in parsedInput) {
    return parsedInput.error;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      event_day_type: parsedInput.data.eventDayType,
      item_id: parsedInput.data.itemId,
      quantity: parsedInput.data.quantity,
      from_location_id: parsedInput.data.fromLocationId,
      to_location_id: parsedInput.data.toLocationId,
      scheduled_start_time: parsedInput.data.scheduledStartTime,
      scheduled_end_time: parsedInput.data.scheduledEndTime,
      leader_user_id: parsedInput.data.leaderUserId,
      current_status: parsedInput.data.currentStatus,
      note: parsedInput.data.note?.trim() || null,
    })
    .eq("task_id", taskId)
    .eq("lock_version", expectedLockVersion)
    .is("deleted", null)
    .select("task_id,lock_version")
    .maybeSingle();

  if (error) {
    return { ok: false, message: "タスクの保存に失敗しました" };
  }

  if (!data) {
    return {
      ok: false,
      code: "task_version_conflict",
      message: TASK_VERSION_CONFLICT_MESSAGE,
    };
  }

  revalidatePath("/admin/tasks");
  refresh();
  return { ok: true };
}

export async function deleteTaskAction(
  taskId: string,
  expectedLockVersion: number,
): Promise<ActionResult> {
  await requireAdminUser();

  if (!taskId) {
    return { ok: false, message: "対象タスクが見つかりません" };
  }

  if (!Number.isSafeInteger(expectedLockVersion) || expectedLockVersion < 0) {
    return { ok: false, message: "タスクの更新情報が不正です" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ deleted: new Date().toISOString() })
    .eq("task_id", taskId)
    .eq("lock_version", expectedLockVersion)
    .is("deleted", null)
    .select("task_id,lock_version")
    .maybeSingle();

  if (error) {
    return { ok: false, message: "削除に失敗しました" };
  }

  if (!data) {
    return {
      ok: false,
      code: "task_version_conflict",
      message: TASK_VERSION_CONFLICT_MESSAGE,
    };
  }

  revalidatePath("/admin/tasks");
  refresh();
  return { ok: true };
}
