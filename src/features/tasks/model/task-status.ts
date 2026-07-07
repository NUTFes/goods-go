import type { Tables } from "@/types/schema.gen";

export type TaskStatus = Tables<"tasks">["current_status"] & (0 | 1 | 2);

const taskStatusLabelMap: Record<TaskStatus, string> = {
  0: "未着手",
  1: "進行中",
  2: "完了",
};

export function getTaskStatusLabel(status: TaskStatus): string {
  return taskStatusLabelMap[status];
}
