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
      className="relative flex justify-between pt-1"
      role="img"
      aria-label={`現在のステータス: ${getTaskStatusLabel(status)}`}
    >
      <div className="absolute left-5 right-5 top-[11px] flex h-0.5" aria-hidden="true">
        {TASK_STATUS_OPTIONS.slice(1).map((option) => (
          <span
            key={option.value}
            className={cn("flex-1", option.value <= status ? "bg-[#F08300]" : "bg-[#e5e5e5]")}
          />
        ))}
      </div>
      {TASK_STATUS_OPTIONS.map((option) => {
        const reached = option.value <= status;

        return (
          <div key={option.value} className="relative flex w-10 flex-col items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex size-4 items-center justify-center rounded-full border-2",
                reached
                  ? "border-[#F08300] bg-[#F08300] text-white"
                  : "border-[#e5e5e5] bg-white text-[#a3a3a3]",
              )}
            >
              {reached ? <Check className="size-2.5 stroke-[3]" /> : null}
            </span>
            <span
              className={cn(
                "text-center text-xs leading-4",
                reached ? "text-[#E87000]" : "text-[#a3a3a3]",
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
      className="grid w-full overflow-hidden rounded-lg border border-[#bfbfbf] bg-white"
      style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(0, 1fr))` }}
      aria-label="タスクステータス"
    >
      {statuses.map((status, index) => (
        <ToggleGroupItem
          key={status}
          value={String(status)}
          aria-label={getTaskStatusLabel(status)}
          className={cn(
            "h-11 w-full min-w-0 rounded-none bg-white px-1 text-sm text-[#595959] transition-colors hover:bg-[#f5f5f5]",
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
