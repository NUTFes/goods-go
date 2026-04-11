"use server";

import { refresh, revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { type LocationFormInput, locationFormSchema } from "../model/schema";
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

function parseLocationInput(
  input: LocationFormInput,
): { data: LocationFormInput } | { error: ActionResult } {
  const parsed = locationFormSchema.safeParse(input);

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

function toLocationActionError(message: string): ActionResult {
  return { ok: false, message };
}

async function getActiveLocation(locationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("location_id,parent_location_id,name")
    .eq("location_id", locationId)
    .is("deleted", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function hasActiveChildren(locationId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("locations")
    .select("location_id", { count: "exact", head: true })
    .eq("parent_location_id", locationId)
    .is("deleted", null);

  if (error) {
    return true;
  }

  return (count ?? 0) > 0;
}

async function isLocationUsedInActiveTasks(locationId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("tasks")
    .select("task_id", { count: "exact", head: true })
    .or(`from_location_id.eq.${locationId},to_location_id.eq.${locationId}`)
    .is("deleted", null);

  if (error) {
    return true;
  }

  return (count ?? 0) > 0;
}

function isDuplicateError(code?: string) {
  return code === "23505";
}

export async function createLocationAction(
  parentLocationId: string | null,
  input: LocationFormInput,
): Promise<ActionResult> {
  await requireAdminUser();

  const parsedInput = parseLocationInput(input);
  if ("error" in parsedInput) {
    return parsedInput.error;
  }

  if (parentLocationId) {
    const parent = await getActiveLocation(parentLocationId);
    if (!parent) {
      return toLocationActionError("親となる場所が見つかりません");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("locations").insert({
    parent_location_id: parentLocationId,
    name: parsedInput.data.name,
  });

  if (error) {
    if (isDuplicateError(error.code)) {
      return toLocationActionError("すでにあるエリアです");
    }

    return toLocationActionError("場所の追加に失敗しました");
  }

  revalidatePath("/admin/locations");
  refresh();
  return { ok: true };
}

export async function updateLocationAction(
  locationId: string,
  input: LocationFormInput,
): Promise<ActionResult> {
  await requireAdminUser();

  if (!locationId) {
    return toLocationActionError("対象の場所が見つかりません");
  }

  const parsedInput = parseLocationInput(input);
  if ("error" in parsedInput) {
    return parsedInput.error;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .update({ name: parsedInput.data.name })
    .eq("location_id", locationId)
    .is("deleted", null)
    .select("location_id")
    .maybeSingle();

  if (error) {
    if (isDuplicateError(error.code)) {
      return toLocationActionError("すでにあるエリアです");
    }

    return toLocationActionError("場所の保存に失敗しました");
  }

  if (!data) {
    return toLocationActionError("対象の場所が見つかりません");
  }

  revalidatePath("/admin/locations");
  refresh();
  return { ok: true };
}

export async function deleteLocationAction(locationId: string): Promise<ActionResult> {
  await requireAdminUser();

  if (!locationId) {
    return toLocationActionError("対象の場所が見つかりません");
  }

  if (await hasActiveChildren(locationId)) {
    return toLocationActionError("子階層がある場所は削除できません");
  }

  if (await isLocationUsedInActiveTasks(locationId)) {
    return toLocationActionError("タスクで使用中の場所は削除できません");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .update({ deleted: new Date().toISOString() })
    .eq("location_id", locationId)
    .is("deleted", null)
    .select("location_id")
    .maybeSingle();

  if (error) {
    return toLocationActionError("場所の削除に失敗しました");
  }

  if (!data) {
    return toLocationActionError("対象の場所が見つかりません");
  }

  revalidatePath("/admin/locations");
  refresh();
  return { ok: true };
}
