import { APP_ROLES } from "@/lib/auth/roles";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/schema.gen";
import { normalizeTimeValue } from "../model/mappers";
import type {
  UserTask,
  UserTaskFilterOption,
  UserTaskListPageData,
  UserTaskQueryState,
} from "../model/types";

type TaskRow = Tables<"tasks">;
type ItemRow = Tables<"items">;
type LocationRow = Tables<"locations">;
type UserRow = Tables<"users">;
type UserNameRow = Pick<UserRow, "user_id" | "name">;

function toFilterOption(
  rows: { id: string; name: string; group: string }[],
): UserTaskFilterOption[] {
  return rows
    .map((row) => ({
      value: row.id,
      label: row.name,
      group: row.group,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "ja"));
}

function mapTask(
  row: TaskRow,
  itemNameById: Map<string, string>,
  locationNameById: Map<string, string>,
  userNameById: Map<string, string>,
  currentUserId: string,
  currentUserName: string,
): UserTask {
  const leaderName = !row.leader_user_id
    ? null
    : (userNameById.get(row.leader_user_id) ??
      (row.leader_user_id === currentUserId ? currentUserName : "担当者"));

  return {
    taskId: row.task_id,
    eventDayType: row.event_day_type as 0 | 1 | 2,
    currentStatus: row.current_status as 0 | 1 | 2,
    itemId: row.item_id,
    itemName: itemNameById.get(row.item_id) ?? "-",
    quantity: row.quantity,
    fromLocationId: row.from_location_id,
    fromLocationName: locationNameById.get(row.from_location_id) ?? "-",
    toLocationId: row.to_location_id,
    toLocationName: locationNameById.get(row.to_location_id) ?? "-",
    scheduledStartTime: normalizeTimeValue(row.scheduled_start_time),
    scheduledEndTime: normalizeTimeValue(row.scheduled_end_time),
    leaderUserId: row.leader_user_id,
    leaderName,
    note: row.note,
  };
}

export async function getUserTaskListPageData(
  queryState: UserTaskQueryState,
): Promise<UserTaskListPageData> {
  const currentUser = await requireAuthenticatedUser();
  const supabase = await createClient();

  let tasksQuery = supabase
    .from("tasks")
    .select(
      "task_id,event_day_type,item_id,quantity,from_location_id,to_location_id,scheduled_start_time,scheduled_end_time,leader_user_id,current_status,note,created,deleted",
    )
    .eq("event_day_type", Number(queryState.filters.day))
    .is("deleted", null);

  if (queryState.filters.statuses.length > 0) {
    tasksQuery = tasksQuery.in("current_status", queryState.filters.statuses);
  }

  if (queryState.filters.fromLocationId) {
    tasksQuery = tasksQuery.eq("from_location_id", queryState.filters.fromLocationId);
  }

  if (queryState.filters.toLocationId) {
    tasksQuery = tasksQuery.eq("to_location_id", queryState.filters.toLocationId);
  }

  if (queryState.filters.itemIds.length > 0) {
    tasksQuery = tasksQuery.in("item_id", queryState.filters.itemIds);
  }

  const usersPromise = (async () => {
    if (currentUser.role !== APP_ROLES.ADMIN) {
      return { data: [] as UserNameRow[], error: null as null };
    }

    const result = await supabase.from("users").select("user_id,name").is("deleted", null);
    if (result.error) {
      return { data: [] as UserNameRow[], error: result.error };
    }

    return { data: (result.data ?? []) as UserNameRow[], error: null as null };
  })();

  const [tasksResult, itemsResult, locationsResult, usersResult] = await Promise.all([
    tasksQuery
      .order("scheduled_start_time", { ascending: true })
      .order("created", { ascending: false }),
    supabase.from("items").select("item_id,name").is("deleted", null),
    supabase.from("locations").select("location_id,name,parent_location_id").is("deleted", null),
    usersPromise,
  ]);

  if (tasksResult.error) {
    throw new Error(tasksResult.error.message);
  }
  if (itemsResult.error) {
    throw new Error(itemsResult.error.message);
  }
  if (locationsResult.error) {
    throw new Error(locationsResult.error.message);
  }
  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }

  const taskRows = (tasksResult.data ?? []) as TaskRow[];
  const itemRows = (itemsResult.data ?? []) as ItemRow[];
  const locationRows = (locationsResult.data ?? []) as LocationRow[];
  const itemNameById = new Map(itemRows.map((item) => [item.item_id, item.name]));
  const locationNameById = new Map(
    locationRows.map((location) => [location.location_id, location.name]),
  );
  const userNameById = new Map((usersResult.data ?? []).map((user) => [user.user_id, user.name]));
  userNameById.set(currentUser.userId, currentUser.name);
  const locationById = new Map(locationRows.map((location) => [location.location_id, location]));

  const locationOptions = toFilterOption(
    locationRows.map((location) => {
      const parent =
        location.parent_location_id && locationById.get(location.parent_location_id)
          ? locationById.get(location.parent_location_id)?.name
          : null;

      return {
        id: location.location_id,
        name: location.name,
        group: parent ?? location.name,
      };
    }),
  );

  return {
    currentUser: {
      userId: currentUser.userId,
      name: currentUser.name,
      role: currentUser.role,
    },
    tasks: taskRows.map((row) =>
      mapTask(
        row,
        itemNameById,
        locationNameById,
        userNameById,
        currentUser.userId,
        currentUser.name,
      ),
    ),
    filterOptions: {
      items: toFilterOption(
        itemRows.map((item) => ({ id: item.item_id, name: item.name, group: "物品" })),
      ),
      locations: locationOptions,
    },
  };
}
