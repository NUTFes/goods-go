"use client";

import { ArrowUpDown, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskStatusBadge } from "@/features/tasks/ui/task-status-badge";
import { getEventDayBadgeClass, getEventDayLabel } from "../model/mappers";
import type { AdminTask, TaskSortKey, TaskSortState } from "../model/types";

type TaskTableProps = {
  tasks: AdminTask[];
  sort: TaskSortState;
  isNavigating?: boolean;
  onSort: (key: TaskSortKey) => void;
  onViewPhotos: (task: AdminTask) => void;
  onEdit: (task: AdminTask) => void;
  onDelete: (task: AdminTask) => void;
};

function sortIconClass(sort: TaskSortState, key: TaskSortKey): string {
  if (sort.key !== key) {
    return "size-3.5 opacity-70";
  }

  return sort.direction === "asc" ? "size-3.5" : "size-3.5 rotate-180";
}

function TruncatedCellText({
  value,
  className = "max-w-[112px]",
}: {
  value: string;
  className?: string;
}) {
  return (
    <span className={`block truncate ${className}`} title={value}>
      {value}
    </span>
  );
}

export function TaskTable({
  tasks,
  sort,
  isNavigating,
  onSort,
  onViewPhotos,
  onEdit,
  onDelete,
}: TaskTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <Table className="min-w-[1312px] table-fixed">
        <colgroup>
          <col className="w-[86px]" />
          <col className="w-[106px]" />
          <col className="w-[112px]" />
          <col className="w-[112px]" />
          <col className="w-[114px]" />
          <col className="w-[128px]" />
          <col className="w-[100px]" />
          <col className="w-[100px]" />
          <col className="w-[100px]" />
          <col className="w-[128px]" />
          <col className="w-[94px]" />
          <col className="w-[44px]" />
          <col className="w-[44px]" />
          <col className="w-[44px]" />
        </colgroup>
        <TableHeader className="[&_tr]:border-none">
          <TableRow className="bg-zinc-900 hover:bg-zinc-900 [&>th]:px-4">
            <TableHead className="h-11 text-white text-center first:rounded-tl-lg">日付</TableHead>
            <TableHead className="h-11 text-white">
              <button
                type="button"
                onClick={() => onSort("status")}
                disabled={isNavigating}
                className="flex items-center gap-1 mx-auto"
              >
                <span>ステータス</span>
                <ArrowUpDown className={sortIconClass(sort, "status")} aria-hidden="true" />
              </button>
            </TableHead>
            <TableHead className="h-11 text-white text-center">From</TableHead>
            <TableHead className="h-11 text-white text-center">To</TableHead>
            <TableHead className="h-11 text-white">
              <button
                type="button"
                onClick={() => onSort("itemAndQuantity")}
                disabled={isNavigating}
                className="flex items-center gap-1 mx-auto"
              >
                <span>物品・個数</span>
                <ArrowUpDown
                  className={sortIconClass(sort, "itemAndQuantity")}
                  aria-hidden="true"
                />
              </button>
            </TableHead>
            <TableHead className="h-11 text-white">
              <button
                type="button"
                onClick={() => onSort("scheduledStartTime")}
                disabled={isNavigating}
                className="flex items-center gap-1 mx-auto"
              >
                <span>予定開始時刻</span>
                <ArrowUpDown
                  className={sortIconClass(sort, "scheduledStartTime")}
                  aria-hidden="true"
                />
              </button>
            </TableHead>
            <TableHead className="h-11 text-white text-center">予定終了時刻</TableHead>
            <TableHead className="h-11 text-white text-center">作業開始時刻</TableHead>
            <TableHead className="h-11 text-white text-center">作業終了時刻</TableHead>
            <TableHead className="h-11 text-white text-center">指揮者</TableHead>
            <TableHead className="h-11 text-white text-center">備考</TableHead>
            <TableHead className="h-11 w-11 min-w-11 bg-zinc-900 text-center text-white sticky right-[88px] before:absolute before:inset-y-0 before:-left-3 before:w-3 before:bg-linear-to-r before:from-transparent before:to-black/20 before:pointer-events-none before:content-[''] z-10 border-l border-zinc-800 !px-1">
              確認
            </TableHead>
            <TableHead className="h-11 w-11 min-w-11 bg-zinc-900 text-center text-white sticky right-11 z-10 !px-1">
              編集
            </TableHead>
            <TableHead className="h-11 w-11 min-w-11 bg-zinc-900 text-center text-white sticky right-0 last:rounded-tr-lg z-10 !px-1">
              削除
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.taskId} className="bg-white hover:bg-transparent [&>td]:px-4">
              <TableCell className="text-center">
                <Badge className={getEventDayBadgeClass(task.eventDayType)}>
                  {getEventDayLabel(task.eventDayType)}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <TaskStatusBadge status={task.currentStatus} />
              </TableCell>
              <TableCell className="text-center">
                <TruncatedCellText value={task.fromLocationName} />
              </TableCell>
              <TableCell className="text-center">
                <TruncatedCellText value={task.toLocationName} />
              </TableCell>
              <TableCell className="text-center">
                <TruncatedCellText
                  value={`${task.itemName} × ${task.quantity}`}
                  className="max-w-[120px]"
                />
              </TableCell>
              <TableCell className="text-center">{task.scheduledStartTime}</TableCell>
              <TableCell className="text-center">{task.scheduledEndTime}</TableCell>
              <TableCell className="text-center">{task.actualStartTime ?? "-"}</TableCell>
              <TableCell className="text-center">{task.actualEndTime ?? "-"}</TableCell>
              <TableCell className="text-center">
                <TruncatedCellText value={task.leaderName ?? "-"} className="max-w-[120px]" />
              </TableCell>
              <TableCell className="text-center">
                <TruncatedCellText value={task.note || "-"} className="max-w-[104px]" />
              </TableCell>
              <TableCell className="text-center bg-white sticky right-[88px] before:absolute before:inset-y-0 before:-left-3 before:w-3 before:bg-linear-to-r before:from-transparent before:to-black/4 before:pointer-events-none before:content-[''] z-10 border-l border-zinc-200 !px-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="relative"
                  disabled={task.photoCount === 0}
                  onClick={() => onViewPhotos(task)}
                  aria-label={`写真を確認（${task.photoCount}枚）`}
                >
                  <ImageIcon className="size-[18px]" aria-hidden="true" />
                  <span className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-[10px] leading-none text-white">
                    {task.photoCount}
                  </span>
                </Button>
              </TableCell>
              <TableCell className="text-center bg-white sticky right-11 z-10 !px-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEdit(task)}
                  aria-label="編集"
                >
                  <Pencil className="size-4 text-green-600" aria-hidden="true" />
                </Button>
              </TableCell>
              <TableCell className="text-center bg-white sticky right-0 z-10 !px-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDelete(task)}
                  aria-label="削除"
                >
                  <Trash2 className="size-4 text-red-600" aria-hidden="true" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {tasks.length === 0 && (
            <TableRow className="bg-white hover:bg-transparent">
              <TableCell colSpan={14} className="py-12 text-center text-sm text-zinc-500">
                該当するタスクはありません
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
