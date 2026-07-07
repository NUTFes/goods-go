import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTaskStatusLabel, type TaskStatus } from "../model/task-status";

type TaskStatusBadgeColorScheme = "admin" | "user";

type TaskStatusBadgeProps = Omit<ComponentProps<typeof Badge>, "children"> & {
  status: TaskStatus;
  colorScheme?: TaskStatusBadgeColorScheme;
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
