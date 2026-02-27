import { requireAdminUser } from "@/lib/auth/guards";
import { APP_ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/schema.gen";
import {
  buildQuarterHourOptions,
  normalizeTimeValue,
  sortAdminTasks,
} from "../model/mappers";
import type {
  AdminTaskListPageData,
  TaskFormOption,
  TaskListQueryState,
} from "../model/types";

type TaskRow = Tables<"tasks">;
type ItemRow = Tables<"items">;
type LocationRow = Tables<"locations">;
type LeaderRow = Tables<"users">;

function toTaskFormOption(
  rows: { id: string; name: string }[],
  group: string,
): TaskFormOption[] {
  return rows
    .map((row) => ({
      value: row.id,
      label: row.name,
      group,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "ja"));
}

export async function getAdminTaskListPageData(
  queryState: TaskListQueryState,
): Promise<AdminTaskListPageData> {
  await requireAdminUser();

  const supabase = await createClient();

  let tasksQuery = supabase
    .from("tasks")
    .select(
      "task_id,event_day_type,item_id,quantity,from_location_id,to_location_id,scheduled_start_time,scheduled_end_time,actual_start_time,actual_end_time,leader_user_id,current_status,note,created",
    )
    .is("deleted", null);

  if (queryState.filters.day !== "all") {
    tasksQuery = tasksQuery.eq(
      "event_day_type",
      Number(queryState.filters.day),
    );
  }

  if (queryState.filters.status !== "all") {
    tasksQuery = tasksQuery.eq(
      "current_status",
      Number(queryState.filters.status),
    );
  }

  if (queryState.filters.itemId) {
    tasksQuery = tasksQuery.eq("item_id", queryState.filters.itemId);
  }

  if (queryState.filters.leaderUserId) {
    tasksQuery = tasksQuery.eq(
      "leader_user_id",
      queryState.filters.leaderUserId,
    );
  }

  if (queryState.filters.fromLocationId) {
    tasksQuery = tasksQuery.eq(
      "from_location_id",
      queryState.filters.fromLocationId,
    );
  }

  if (queryState.filters.toLocationId) {
    tasksQuery = tasksQuery.eq(
      "to_location_id",
      queryState.filters.toLocationId,
    );
  }

  tasksQuery = tasksQuery.order("created", { ascending: false });

  const [tasksResult, itemsResult, locationsResult, leadersResult] =
    await Promise.all([
      tasksQuery,
      supabase.from("items").select("item_id,name").is("deleted", null),
      supabase.from("locations").select("location_id,name").is("deleted", null),
      supabase
        .from("users")
        .select("user_id,name,role")
        .is("deleted", null)
        .in("role", [APP_ROLES.ADMIN, APP_ROLES.LEADER]),
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

  if (leadersResult.error) {
    throw new Error(leadersResult.error.message);
  }

  const tasksRows = (tasksResult.data ?? []) as TaskRow[];
  const itemRows = (itemsResult.data ?? []) as ItemRow[];
  const locationRows = (locationsResult.data ?? []) as LocationRow[];
  const leaderRows = (leadersResult.data ?? []) as LeaderRow[];

  const itemNameById = new Map(
    itemRows.map((item) => [item.item_id, item.name]),
  );
  const locationNameById = new Map(
    locationRows.map((location) => [location.location_id, location.name]),
  );
  const leaderNameById = new Map(
    leaderRows.map((leader) => [leader.user_id, leader.name]),
  );

  const tasks = sortAdminTasks(
    tasksRows.map((task) => ({
      taskId: task.task_id,
      eventDayType: task.event_day_type as 0 | 1 | 2,
      currentStatus: task.current_status as 0 | 1 | 2,
      itemId: task.item_id,
      itemName: itemNameById.get(task.item_id) ?? "-",
      quantity: task.quantity,
      fromLocationId: task.from_location_id,
      fromLocationName: locationNameById.get(task.from_location_id) ?? "-",
      toLocationId: task.to_location_id,
      toLocationName: locationNameById.get(task.to_location_id) ?? "-",
      scheduledStartTime: normalizeTimeValue(task.scheduled_start_time) ?? "-",
      scheduledEndTime: normalizeTimeValue(task.scheduled_end_time) ?? "-",
      actualStartTime: normalizeTimeValue(task.actual_start_time),
      actualEndTime: normalizeTimeValue(task.actual_end_time),
      leaderUserId: task.leader_user_id,
      leaderName: task.leader_user_id
        ? (leaderNameById.get(task.leader_user_id) ?? null)
        : null,
      note: task.note,
    })),
    queryState.sort,
  );

  return {
    tasks,
    filterOptions: {
      items: toTaskFormOption(
        itemRows.map((item) => ({ id: item.item_id, name: item.name })),
        "物品",
      ),
      leaders: toTaskFormOption(
        leaderRows.map((leader) => ({ id: leader.user_id, name: leader.name })),
        "指揮者",
      ),
      locations: toTaskFormOption(
        locationRows.map((location) => ({
          id: location.location_id,
          name: location.name,
        })),
        "場所",
      ),
      timeOptions: buildQuarterHourOptions(),
    },
  };
}
