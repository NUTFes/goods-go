import { requireAdminUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/schema.gen";
import type { AdminLocation, AdminLocationListPageData } from "../model/types";

type LocationRow = Tables<"locations">;

type LocationNodeSeed = Omit<AdminLocation, "depth" | "children">;

function buildLocationTree(rows: LocationRow[]): AdminLocation[] {
  const childrenByParentId = new Map<string | null, LocationNodeSeed[]>();

  for (const row of rows) {
    const node: LocationNodeSeed = {
      locationId: row.location_id,
      parentLocationId: row.parent_location_id,
      name: row.name,
    };

    const siblings = childrenByParentId.get(row.parent_location_id) ?? [];
    siblings.push(node);
    childrenByParentId.set(row.parent_location_id, siblings);
  }

  const attachChildren = (parentId: string | null, depth: number): AdminLocation[] => {
    const siblings = childrenByParentId.get(parentId) ?? [];

    return siblings.map((node) => ({
      ...node,
      depth,
      children: attachChildren(node.locationId, depth + 1),
    }));
  };

  return attachChildren(null, 0);
}

export async function getAdminLocationListPageData(): Promise<AdminLocationListPageData> {
  await requireAdminUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("location_id,parent_location_id,name")
    .is("deleted", null)
    .order("parent_location_id", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const locations = buildLocationTree((data ?? []) as LocationRow[]);

  return { locations };
}
