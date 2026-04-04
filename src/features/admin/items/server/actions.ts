"use server";

import { refresh, revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { type ItemFormInput, itemFormSchema } from "../model/schema";
import type { ActionResult } from "../model/types";

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

function parseItemInput(input: ItemFormInput): { data: ItemFormInput } | { error: ActionResult } {
  const parsed = itemFormSchema.safeParse(input);
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

function toItemActionError(message: string): ActionResult {
  return { ok: false, message };
}

async function isItemUsedInActiveTasks(itemId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("tasks")
    .select("task_id", { count: "exact", head: true })
    .eq("item_id", itemId)
    .is("deleted", null);

  if (error) {
    return true;
  }

  return (count ?? 0) > 0;
}

export async function createItemAction(input: ItemFormInput): Promise<ActionResult> {
  await requireAdminUser();

  const parsedInput = parseItemInput(input);
  if ("error" in parsedInput) {
    return parsedInput.error;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("items").insert({
    name: parsedInput.data.name,
  });

  if (error) {
    if (error.code === "23505") {
      return toItemActionError("同じ名前の物品がすでに存在します");
    }
    return toItemActionError("物品の追加に失敗しました");
  }

  revalidatePath("/admin/items");
  refresh();
  return { ok: true };
}

export async function updateItemAction(
  itemId: string,
  input: ItemFormInput,
): Promise<ActionResult> {
  await requireAdminUser();

  if (!itemId) {
    return toItemActionError("対象の物品が見つかりません");
  }

  const parsedInput = parseItemInput(input);
  if ("error" in parsedInput) {
    return parsedInput.error;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .update({ name: parsedInput.data.name })
    .eq("item_id", itemId)
    .is("deleted", null)
    .select("item_id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return toItemActionError("同じ名前の物品がすでに存在します");
    }
    return toItemActionError("物品の保存に失敗しました");
  }

  if (!data) {
    return toItemActionError("対象の物品が見つかりません");
  }

  revalidatePath("/admin/items");
  refresh();
  return { ok: true };
}

export async function deleteItemAction(itemId: string): Promise<ActionResult> {
  await requireAdminUser();

  if (!itemId) {
    return toItemActionError("対象の物品が見つかりません");
  }

  if (await isItemUsedInActiveTasks(itemId)) {
    return toItemActionError("タスクで使用中の物品は削除できません");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .update({ deleted: new Date().toISOString() })
    .eq("item_id", itemId)
    .is("deleted", null)
    .select("item_id")
    .maybeSingle();

  if (error) {
    return toItemActionError("物品の削除に失敗しました");
  }

  if (!data) {
    return toItemActionError("対象の物品が見つかりません");
  }

  revalidatePath("/admin/items");
  refresh();
  return { ok: true };
}
