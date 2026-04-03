import { requireAdminUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/schema.gen";
import type { AdminItemListPageData } from "../model/types";

type ItemRow = Tables<"items">;

export async function getAdminItemListPageData(): Promise<AdminItemListPageData> {
  await requireAdminUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .select("item_id,name")
    .is("deleted", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const items = ((data ?? []) as ItemRow[]).map((item) => ({
    itemId: item.item_id,
    name: item.name,
  }));

  return { items };
}
