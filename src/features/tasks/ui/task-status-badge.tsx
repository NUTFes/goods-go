import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/types/schema.gen";
import { cn } from "@/lib/utils";

type TaskStatus = Tables<"tasks">["current_status"] & (0 | 1 | 2);
type TaskStatusBadgeColorScheme = "admin" | "user";

type TaskStatusBadgeProps = Omit<ComponentProps<typeof Badge>, "children"> & {
  status: TaskStatus;
  colorScheme?: TaskStatusBadgeColorScheme;
};

const taskStatusLabelMap: Record<TaskStatus, string> = {
  0: "未着手",
  1: "進行中",
  2: "完了",
};

const taskStatusBadgeClassMap: Record<TaskStatusBadgeColorScheme, Record<TaskStatus, string>> = {
  admin: {
    0: "bg-zinc-700 text-white",
    1: "bg-blue-700 text-white",
    2: "bg-green-700 text-white",
  },
  user: {
    0: "bg-[#595959] text-white",
    1: "bg-[#005BAB] text-white",
    2: "bg-[#007B48] text-white",
  },
};

export function getTaskStatusLabel(status: TaskStatus): string {
  return taskStatusLabelMap[status];
}

export function TaskStatusBadge({
  status,
  colorScheme = "user",
  className,
  ...props
}: TaskStatusBadgeProps) {
  return (
    <Badge
      className={cn("min-w-16", taskStatusBadgeClassMap[colorScheme][status], className)}
      {...props}
    >
      {getTaskStatusLabel(status)}
    </Badge>
  );
}
