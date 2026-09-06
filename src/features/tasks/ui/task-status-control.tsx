"use client";

import { Check } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getTaskStatusLabel, TASK_STATUS_OPTIONS, type TaskStatus } from "../model/task-status";
import { cn } from "@/lib/utils";

type TaskStatusStepperProps = {
  status: TaskStatus;
};

type TaskStatusSegmentedControlProps = {
  value: TaskStatus;
  statuses: readonly TaskStatus[];
  disabled?: boolean;
  onChange: (status: TaskStatus) => void;
};

export function TaskStatusStepper({ status }: TaskStatusStepperProps) {
  return (
    <div
      className="grid grid-cols-4 pt-1"
      role="img"
      aria-label={`現在のステータス: ${getTaskStatusLabel(status)}`}
    >
      {TASK_STATUS_OPTIONS.map((option, index) => {
        const reached = option.value <= status;
        const isCurrent = option.value === status;

        return (
          <div key={option.value} className="relative flex min-w-0 flex-col items-center gap-1.5">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-1/2 top-3 h-0.5 w-full",
                  reached ? "bg-[#F08300]" : "bg-[#bfbfbf]",
                )}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex size-6 items-center justify-center rounded-full border-2 bg-white",
                reached ? "border-[#F08300] text-[#F08300]" : "border-[#bfbfbf] text-[#8c8c8c]",
              )}
            >
              {reached && !isCurrent ? (
                <Check className="size-3.5 stroke-[3]" />
              ) : (
                <span
                  className={cn("size-2 rounded-full", reached ? "bg-[#F08300]" : "bg-[#bfbfbf]")}
                />
              )}
            </span>
            <span
              className={cn(
                "text-center text-[11px] leading-tight",
                reached ? "font-semibold text-[#B55700]" : "text-[#737373]",
              )}
            >
              {option.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TaskStatusSegmentedControl({
  value,
  statuses,
  disabled = false,
  onChange,
}: TaskStatusSegmentedControlProps) {
  return (
    <ToggleGroup
      type="single"
      value={String(value)}
      onValueChange={(nextValue) => {
        if (nextValue) {
          onChange(Number(nextValue) as TaskStatus);
        }
      }}
      disabled={disabled}
      className="grid overflow-hidden rounded-lg border border-[#bfbfbf] bg-white"
      style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(0, 1fr))` }}
      aria-label="タスクステータス"
    >
      {statuses.map((status, index) => (
        <ToggleGroupItem
          key={status}
          value={String(status)}
          aria-label={getTaskStatusLabel(status)}
          className={cn(
            "h-9 w-full min-w-0 rounded-none bg-white px-1 text-xs text-[#595959] transition-colors hover:bg-[#f5f5f5]",
            "data-[state=on]:bg-[#121212] data-[state=on]:font-semibold data-[state=on]:text-white data-[state=on]:hover:bg-[#121212]",
            index > 0 && "border-l border-[#bfbfbf]",
          )}
        >
          {getTaskStatusLabel(status)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
