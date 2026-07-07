"use client";

import { Box, ChevronRight, Clock3 } from "lucide-react";
import { getTaskStatusLabel } from "@/features/tasks/model/task-status";
import { TaskStatusBadge } from "@/features/tasks/ui/task-status-badge";
import type { UserTask } from "../model/types";

type TaskCardProps = {
  task: UserTask;
  onClick: () => void;
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const statusText = getTaskStatusLabel(task.currentStatus);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[10px] bg-white px-4 py-3 text-left shadow-md/20 hover:bg-[#fafafa] sm:px-4"
      aria-label={`${statusText}。${task.fromLocationName}から${task.toLocationName}へ。予定時刻${task.scheduledStartTime}。${task.itemName}×${task.quantity}`}
    >
      <div className="flex items-center justify-between gap-3 sm:gap-6">
        <div className="flex-1">
          <TaskStatusBadge status={task.currentStatus} className="h-6 rounded-full px-3 text-xs" />

          <div className="mt-3 space-y-2">
            <p className="flex items-center gap-1.5 font-bold">
              <span className="text-base sm:text-lg">{task.fromLocationName}</span>
              <ChevronRight className="size-4 shrink-0 text-[#919191]" aria-hidden="true" />
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
