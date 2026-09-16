import { Filter, ImageIcon, ListTodo, MapPin, Package, User, X } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EVENT_DAY_OPTIONS, STATUS_OPTIONS } from "../model/mappers";
import type { TaskFilterOptions, TaskFilterState } from "../model/types";

type FilterOption = { value: string; label: string; group: string };

type TaskFilterBarProps = {
  filters: TaskFilterState;
  filterOptions: TaskFilterOptions;
  onChange: (next: TaskFilterState) => void;
};

type SelectFilterProps = {
  value: string;
  icon?: ReactNode;
  placeholder: string;
  options: FilterOption[];
  className?: string;
  showGroups?: boolean;
  onValueChange: (value: string) => void;
};

function groupOptions(options: FilterOption[]): Map<string, FilterOption[]> {
  return options.reduce((groups, option) => {
    const groupOptions = groups.get(option.group) ?? [];
    groupOptions.push(option);
    groups.set(option.group, groupOptions);
    return groups;
  }, new Map<string, FilterOption[]>());
}

function SelectFilter({
  value,
  icon,
  placeholder,
  options,
  className = "w-[148px]",
  showGroups = false,
  onValueChange,
}: SelectFilterProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label;
  const optionGroups = groupOptions(options);

  return (
    <Select
      value={value || "all"}
      onValueChange={(nextValue) => onValueChange(nextValue === "all" ? "" : nextValue)}
    >
      <SelectTrigger
        className={`h-9 bg-white text-sm ${className}`}
        aria-label={selectedLabel ? `${placeholder}: ${selectedLabel}` : placeholder}
      >
        {icon && (
          <span aria-hidden="true" className="flex items-center justify-center">
            {icon}
          </span>
        )}
        <SelectValue placeholder={placeholder}>{value ? selectedLabel : placeholder}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-w-[280px]">
        <SelectItem value="all">すべて</SelectItem>
        {showGroups
          ? Array.from(optionGroups.entries()).map(([groupName, groupItems]) =>
              groupName ? (
                <SelectGroup key={groupName}>
                  <SelectLabel>{groupName}</SelectLabel>
                  {groupItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="block max-w-[232px] truncate" title={option.label}>
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : (
                <Fragment key="ungrouped-location-options">
                  {groupItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="block max-w-[232px] truncate" title={option.label}>
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </Fragment>
              ),
            )
          : options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="block max-w-[232px] truncate" title={option.label}>
                  {option.label}
                </span>
              </SelectItem>
            ))}
      </SelectContent>
    </Select>
  );
}

function resolveLabel(options: { value: string; label: string }[], value: string): string | null {
  if (!value) {
    return null;
  }

  return options.find((option) => option.value === value)?.label ?? null;
}

const statusToggleItemClass =
  "h-9 bg-white px-4 text-sm font-normal text-zinc-600 hover:bg-zinc-100 data-[state=on]:bg-zinc-900 data-[state=on]:text-white";

const dateToggleItemClass =
  "h-11 !w-24 !rounded-t-xl !rounded-b-none !bg-zinc-300 px-5 py-3 text-sm font-bold text-zinc-600 hover:!bg-zinc-200 data-[state=on]:!bg-white data-[state=on]:text-zinc-900";

export function TaskDateTabs({
  filters,
  onChange,
}: Pick<TaskFilterBarProps, "filters" | "onChange">) {
  return (
    <ToggleGroup
      type="single"
      value={filters.day}
      onValueChange={(value) =>
        onChange({
          ...filters,
          day: (value || "all") as TaskFilterState["day"],
        })
      }
      aria-label="日程"
    >
      <ToggleGroupItem value="all" className={dateToggleItemClass}>
        全日程
      </ToggleGroupItem>
      {EVENT_DAY_OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={String(option.value)}
          className={dateToggleItemClass}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function TaskFilterBar({ filters, filterOptions, onChange }: TaskFilterBarProps) {
  const itemLabel = resolveLabel(filterOptions.items, filters.itemId);
  const leaderLabel = resolveLabel(filterOptions.leaders, filters.leaderUserId);
  const fromLabel = resolveLabel(filterOptions.locations, filters.fromLocationId);
  const toLabel = resolveLabel(filterOptions.locations, filters.toLocationId);

  const tags = [
    itemLabel
      ? {
          key: "itemId" as const,
          label: itemLabel,
        }
      : null,
    leaderLabel
      ? {
          key: "leaderUserId" as const,
          label: leaderLabel,
        }
      : null,
    fromLabel
      ? {
          key: "fromLocationId" as const,
          label: `From：${fromLabel}`,
        }
      : null,
    toLabel
      ? {
          key: "toLocationId" as const,
          label: `To：${toLabel}`,
        }
      : null,
  ].filter((tag) => tag !== null);

  return (
    <section className="space-y-3 bg-white px-5 py-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
          <div className="flex shrink-0 items-center gap-1">
            <ListTodo className="size-5 text-zinc-900" aria-hidden="true" />
            <span className="whitespace-nowrap text-sm text-zinc-900">ステータス</span>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            className="shrink-0"
            value={filters.status}
            onValueChange={(value) =>
              onChange({
                ...filters,
                status: (value || "all") as TaskFilterState["status"],
              })
            }
          >
            <ToggleGroupItem value="all" className={statusToggleItemClass}>
              すべて
            </ToggleGroupItem>
            {STATUS_OPTIONS.filter((option) => option.value !== 3).map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={String(option.value)}
                className={statusToggleItemClass}
              >
                {option.label}
              </ToggleGroupItem>
            ))}
            <ToggleGroupItem value="reviewWithPhotos" className={statusToggleItemClass}>
              <ImageIcon className="size-3.5" aria-hidden="true" />
              確認中・写真あり
            </ToggleGroupItem>
            {STATUS_OPTIONS.filter((option) => option.value === 3).map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={String(option.value)}
                className={statusToggleItemClass}
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SelectFilter
            value={filters.itemId}
            icon={<Package className="size-4 text-zinc-500" />}
            placeholder="物品選択"
            options={filterOptions.items}
            className="w-40"
            onValueChange={(value) => onChange({ ...filters, itemId: value })}
          />
          <SelectFilter
            value={filters.leaderUserId}
            icon={<User className="size-4 text-zinc-500" />}
            placeholder="指揮者"
            options={filterOptions.leaders}
            className="w-40"
            onValueChange={(value) => onChange({ ...filters, leaderUserId: value })}
          />
          <SelectFilter
            value={filters.fromLocationId}
            icon={<MapPin className="size-4 text-zinc-500" />}
            placeholder="From"
            options={filterOptions.locations}
            className="w-40"
            showGroups
            onValueChange={(value) => onChange({ ...filters, fromLocationId: value })}
          />
          <SelectFilter
            value={filters.toLocationId}
            icon={<MapPin className="size-4 text-zinc-500" />}
            placeholder="To"
            options={filterOptions.locations}
            className="w-40"
            showGroups
            onValueChange={(value) => onChange({ ...filters, toLocationId: value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-4 text-zinc-600" aria-hidden="true" />
          {tags.map((tag) => (
            <Badge
              key={tag.key}
              variant="outline"
              className="gap-1 rounded-full border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 font-normal"
            >
              <span className="max-w-[192px] truncate" title={tag.label}>
                {tag.label}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    [tag.key]: "",
                  })
                }
                className="ml-1 rounded-full p-0.5 hover:bg-zinc-100"
                aria-label={`${tag.label}フィルターを削除`}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          className="h-auto px-1 text-sm text-zinc-500 underline underline-offset-2"
          onClick={() =>
            onChange({
              day: "all",
              status: "all",
              itemId: "",
              leaderUserId: "",
              fromLocationId: "",
              toLocationId: "",
            })
          }
        >
          フィルターを全てクリア
        </Button>
      </div>
    </section>
  );
}
