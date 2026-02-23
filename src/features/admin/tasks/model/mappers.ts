import type {
  AdminTask,
  EventDayType,
  TaskSortState,
  TaskStatus,
} from "./types";

export const EVENT_DAY_OPTIONS = [
  { value: 0, label: "準々備日" },
  { value: 1, label: "準備日" },
  { value: 2, label: "片付け日" },
] as const;

export const STATUS_OPTIONS = [
  { value: 0, label: "未着手" },
  { value: 1, label: "進行中" },
  { value: 2, label: "完了" },
] as const;

const eventDayLabelMap = Object.fromEntries(
  EVENT_DAY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<EventDayType, string>;

const statusLabelMap = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<TaskStatus, string>;

const eventDayBadgeClassMap: Record<EventDayType, string> = {
  0: "bg-orange-100 text-orange-700",
  1: "bg-purple-100 text-purple-700",
  2: "bg-pink-100 text-pink-700",
};

const statusBadgeClassMap: Record<TaskStatus, string> = {
  0: "bg-zinc-700 text-white",
  1: "bg-blue-700 text-white",
  2: "bg-green-700 text-white",
};

export function getEventDayLabel(value: EventDayType): string {
  return eventDayLabelMap[value];
}

export function getStatusLabel(value: TaskStatus): string {
  return statusLabelMap[value];
}

export function getEventDayBadgeClass(value: EventDayType): string {
  return eventDayBadgeClassMap[value];
}

export function getStatusBadgeClass(value: TaskStatus): string {
  return statusBadgeClassMap[value];
}

export function normalizeTimeValue(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.slice(0, 5);
}

export function buildQuarterHourOptions(): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      options.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      );
    }
  }
  return options;
}

function compareTaskBySort(
  left: AdminTask,
  right: AdminTask,
  sort: TaskSortState,
): number {
  const direction = sort.direction === "asc" ? 1 : -1;

  switch (sort.key) {
    case "status":
      return (left.currentStatus - right.currentStatus) * direction;
    case "itemAndQuantity": {
      const itemResult = left.itemName.localeCompare(right.itemName, "ja");
      if (itemResult !== 0) {
        return itemResult * direction;
      }
      return (left.quantity - right.quantity) * direction;
    }
    case "scheduledStartTime":
      return (
        left.scheduledStartTime.localeCompare(right.scheduledStartTime) *
        direction
      );
    default:
      return 0;
  }
}

export function sortAdminTasks(
  tasks: AdminTask[],
  sort: TaskSortState,
): AdminTask[] {
  return tasks.toSorted((left, right) => compareTaskBySort(left, right, sort));
}
