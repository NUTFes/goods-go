import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTaskStatusLabel, type TaskStatus } from "../model/task-status";

type TaskStatusBadgeProps = Omit<ComponentProps<typeof Badge>, "children"> & {
  status: TaskStatus;
};

const taskStatusBadgeClassMap: Record<TaskStatus, string> = {
  0: "bg-[#595959] text-white",
  1: "bg-[#005BAB] text-white",
  2: "bg-[#B55700] text-white",
  3: "bg-[#007B48] text-white",
};

export function TaskStatusBadge({ status, className, ...props }: TaskStatusBadgeProps) {
  return (
    <Badge className={cn("min-w-16", taskStatusBadgeClassMap[status], className)} {...props}>
      {getTaskStatusLabel(status)}
    </Badge>
  );
}
