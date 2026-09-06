import type { Tables } from "@/types/schema.gen";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";

export const TASK_STATUSES = {
  TODO: 0,
  DOING: 1,
  REVIEW: 2,
  DONE: 3,
} as const;

export const TASK_STATUS_VALUES = [
  TASK_STATUSES.TODO,
  TASK_STATUSES.DOING,
  TASK_STATUSES.REVIEW,
  TASK_STATUSES.DONE,
] as const;

export type TaskStatus = Tables<"tasks">["current_status"] & (typeof TASK_STATUS_VALUES)[number];

const taskStatusLabelMap: Record<TaskStatus, string> = {
  0: "未着手",
  1: "進行中",
  2: "確認中",
  3: "完了",
};

export const TASK_STATUS_OPTIONS = TASK_STATUS_VALUES.map((value) => ({
  value,
  label: taskStatusLabelMap[value],
}));

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "number" && TASK_STATUS_VALUES.some((statusValue) => statusValue === value)
  );
}

export function getTaskStatusLabel(status: TaskStatus): string {
  return taskStatusLabelMap[status];
}

export function canChangeTaskStatus(
  role: AppRole,
  currentStatus: TaskStatus,
  nextStatus: TaskStatus,
): boolean {
  if (role === APP_ROLES.ADMIN) {
    return true;
  }

  return (
    role === APP_ROLES.LEADER &&
    currentStatus !== TASK_STATUSES.DONE &&
    nextStatus !== TASK_STATUSES.DONE
  );
}
