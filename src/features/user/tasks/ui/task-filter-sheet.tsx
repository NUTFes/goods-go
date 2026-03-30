"use client";

import { Triangle } from "lucide-react";
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { STATUS_OPTIONS } from "../model/mappers";
import type { UserTaskFilterOptions, UserTaskFilterState } from "../model/types";

type TaskFilterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: UserTaskFilterState;
  onDraftChange: Dispatch<SetStateAction<UserTaskFilterState>>;
  filterOptions: UserTaskFilterOptions;
  onApply: (filters: UserTaskFilterState) => void;
};

type FilterChipProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

function FilterChip({ label, selected, onClick }: FilterChipProps) {
  return (
    <Button
      type="button"
      variant={selected ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "h-8 rounded-[10px] px-4 text-sm font-normal motion-reduce:transition-none",
        selected
          ? "border-[#121212] bg-[#121212] text-[#fafafa] hover:bg-[#121212]/90"
          : "border-[#171717] bg-white text-[#171717]",
      )}
    >
      {label}
    </Button>
  );
}

export function TaskFilterSheet({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  filterOptions,
  onApply,
}: TaskFilterSheetProps) {
  const descriptionId = "task-filter-sheet-description";

  const locationGroups = useMemo(() => {
    return filterOptions.locations.map((option) => ({ value: option.value, label: option.label }));
  }, [filterOptions.locations]);

  const toggleStatus = (status: 0 | 1 | 2) => {
    onDraftChange((prev) => {
      if (prev.statuses.includes(status)) {
        return { ...prev, statuses: prev.statuses.filter((value) => value !== status) };
      }
      return { ...prev, statuses: [...prev.statuses, status].toSorted() as (0 | 1 | 2)[] };
    });
  };

  const toggleItem = (itemId: string) => {
    onDraftChange((prev) => {
      if (prev.itemIds.includes(itemId)) {
        return { ...prev, itemIds: prev.itemIds.filter((value) => value !== itemId) };
      }
      return { ...prev, itemIds: [...prev.itemIds, itemId] };
    });
  };

  const handleReset = () => {
    onDraftChange({
      ...draft,
      statuses: [],
      fromLocationId: "",
      toLocationId: "",
      itemIds: [],
    });
  };

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent id="task-filter-sheet">
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>タスクの絞り込み</DrawerTitle>
            <DrawerDescription id={descriptionId} className="sr-only">
              条件を選択して一覧表示を絞り込みます。
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-6 px-4 pb-6 sm:px-6" aria-describedby={descriptionId}>
            <fieldset className="space-y-2">
              <legend className="text-base font-bold">ステータス</legend>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((status) => (
                  <FilterChip
                    key={status.value}
                    label={status.label}
                    selected={draft.statuses.includes(status.value)}
                    onClick={() => toggleStatus(status.value)}
                  />
                ))}
              </div>
            </fieldset>

            <section className="space-y-2">
              <h3 id="task-filter-location-label" className="text-base font-bold">
                場所
              </h3>
              <div className="space-y-2">
                <label htmlFor="task-filter-from-location" className="sr-only">
                  From（搬入元）
                </label>
                <Select
                  key={`from-${draft.fromLocationId || "placeholder"}`}
                  value={draft.fromLocationId || undefined}
                  onValueChange={(value) =>
                    onDraftChange({
                      ...draft,
                      fromLocationId: value === "__none__" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger
                    id="task-filter-from-location"
                    className="h-9 w-full rounded-lg border-[#121212] px-3 text-sm"
                    aria-label="From（搬入元）"
                  >
                    <SelectValue placeholder="From（搬入元）" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg p-1 shadow-[0px_4px_6px_rgba(0,0,0,0.1),0px_2px_4px_rgba(0,0,0,0.1)]">
                    <SelectItem value="__none__">未選択</SelectItem>
                    {locationGroups.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex justify-center">
                  <Triangle
                    className="size-6 rotate-180 fill-[#121212] text-[#121212]"
                    aria-hidden="true"
                  />
                </div>

                <label htmlFor="task-filter-to-location" className="sr-only">
                  To（搬入先）
                </label>
                <Select
                  key={`to-${draft.toLocationId || "placeholder"}`}
                  value={draft.toLocationId || undefined}
                  onValueChange={(value) =>
                    onDraftChange({
                      ...draft,
                      toLocationId: value === "__none__" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger
                    id="task-filter-to-location"
                    className="h-9 w-full rounded-lg border-[#121212] px-3 text-sm"
                    aria-label="To（搬入先）"
                  >
                    <SelectValue placeholder="To（搬入先）" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg p-1 shadow-[0px_4px_6px_rgba(0,0,0,0.1),0px_2px_4px_rgba(0,0,0,0.1)]">
                    <SelectItem value="__none__">未選択</SelectItem>
                    {locationGroups.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <fieldset className="space-y-2">
              <legend className="text-base font-bold">物品</legend>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.items.map((item) => (
                  <FilterChip
                    key={item.value}
                    label={item.label}
                    selected={draft.itemIds.includes(item.value)}
                    onClick={() => toggleItem(item.value)}
                  />
                ))}
              </div>
            </fieldset>

            <Separator className="bg-[#e5e5e5]" />

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-lg border-[#121212]"
                onClick={handleReset}
              >
                リセット
              </Button>
              <Button
                type="button"
                size="wide"
                className="h-10 rounded-lg bg-[#121212] hover:bg-[#121212]/90"
                onClick={handleApply}
              >
                絞りこむ
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
