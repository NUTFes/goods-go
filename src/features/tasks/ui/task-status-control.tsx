"use client";

import { Check } from "lucide-react";
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
    <div
      className="grid overflow-hidden rounded-lg border border-[#bfbfbf] bg-white"
      style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(0, 1fr))` }}
      role="radiogroup"
      aria-label="タスクステータス"
    >
      {statuses.map((status, index) => {
        const selected = status === value;
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(status)}
            className={cn(
              "h-9 min-w-0 px-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              index > 0 && "border-l border-[#bfbfbf]",
              selected
                ? "bg-[#121212] font-semibold text-white"
                : "bg-white text-[#595959] hover:bg-[#f5f5f5]",
            )}
          >
            {getTaskStatusLabel(status)}
          </button>
        );
      })}
    </div>
  );
}
