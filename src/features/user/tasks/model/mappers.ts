import { getAppRoleLabel, type AppRole } from "@/lib/auth/roles";
import type { TaskStatus } from "./types";

export const EVENT_DAY_OPTIONS = [
  { value: "0", label: "準々備日" },
  { value: "1", label: "準備日" },
  { value: "2", label: "片付け日" },
] as const;

export const STATUS_OPTIONS = [
  { value: 0 as TaskStatus, label: "未着手" },
  { value: 1 as TaskStatus, label: "進行中" },
  { value: 2 as TaskStatus, label: "完了" },
] as const;

const statusLabelMap = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label])) as Record<
  TaskStatus,
  string
>;

const statusBadgeClassMap: Record<TaskStatus, string> = {
  0: "bg-[#595959] text-white",
  1: "bg-[#005BAB] text-white",
  2: "bg-[#007B48] text-white",
};

const statusDotClassMap: Record<TaskStatus, string> = {
  0: "bg-[#595959]",
  1: "bg-[#005BAB]",
  2: "bg-[#007B48]",
};

export function getStatusLabel(value: TaskStatus): string {
  return statusLabelMap[value];
}

export function getStatusBadgeClass(value: TaskStatus): string {
  return statusBadgeClassMap[value];
}

export function getStatusDotClass(value: TaskStatus): string {
  return statusDotClassMap[value];
}

export function normalizeTimeValue(value: string | null): string {
  if (!value) {
    return "-";
  }
  return value.slice(0, 5);
}

export function getRoleLabel(role: AppRole): string {
  return getAppRoleLabel(role);
}
