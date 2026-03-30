"use client";

import { Box, ChevronRight, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStatusBadgeClass } from "../model/mappers";
import type { UserTask } from "../model/types";

type TaskCardProps = {
  task: UserTask;
  onClick: () => void;
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const statusText =
    task.currentStatus === 0 ? "未着手" : task.currentStatus === 1 ? "進行中" : "完了";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[10px] bg-white px-4 py-3 text-left shadow-md/20 hover:bg-[#fafafa] sm:px-4"
      aria-label={`${statusText}。${task.fromLocationName}から${task.toLocationName}へ。予定時刻${task.scheduledStartTime}。${task.itemName}×${task.quantity}`}
    >
      <div className="flex items-center justify-between gap-3 sm:gap-6">
        <div className="flex-1">
          <Badge
            className={cn(
              "h-6 rounded-full px-3 text-xs text-white",
              getStatusBadgeClass(task.currentStatus),
            )}
          >
            {task.currentStatus === 0 ? "未着手" : task.currentStatus === 1 ? "進行中" : "完了"}
          </Badge>

          <div className="mt-3 space-y-2">
            <p className="flex items-center gap-1.5 font-bold">
              <span className="text-base sm:text-lg">{task.fromLocationName}</span>
              <span
                className="inline-block h-0 w-0 border-y-[7px] border-l-10 border-y-transparent border-l-[#919191]"
                aria-hidden="true"
              />
              <span className="sr-only">から</span>
              <span className="text-base sm:text-lg">{task.toLocationName}</span>
            </p>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex items-center gap-1">
                <Clock3 className="size-3" aria-hidden="true" />
                {task.scheduledStartTime}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-xl border border-[#e5e5e5] px-3 py-1">
                <Box className="size-3" aria-hidden="true" />
                {`${task.itemName}×${task.quantity}`}
              </span>
            </div>
          </div>
        </div>

        <ChevronRight className="size-5 shrink-0 text-[#171717]" aria-hidden="true" />
      </div>
    </button>
  );
}
