import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TaskStatusBadgeProps = ComponentProps<typeof Badge>;

export function TaskStatusBadge({ className, ...props }: TaskStatusBadgeProps) {
  return <Badge className={cn("min-w-16", className)} {...props} />;
}
