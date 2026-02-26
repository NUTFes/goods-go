"use client";

import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
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
import {
  getEventDayBadgeClass,
  getEventDayLabel,
  getStatusBadgeClass,
  getStatusLabel,
} from "../model/mappers";
import type { AdminTask, TaskSortKey, TaskSortState } from "../model/types";

type TaskTableProps = {
  tasks: AdminTask[];
  sort: TaskSortState;
  isNavigating?: boolean;
  onSort: (key: TaskSortKey) => void;
  onEdit: (task: AdminTask) => void;
  onDelete: (task: AdminTask) => void;
};

function sortIconClass(sort: TaskSortState, key: TaskSortKey): string {
  if (sort.key !== key) {
    return "h-3.5 w-3.5 opacity-70";
  }

  return sort.direction === "asc" ? "h-3.5 w-3.5" : "h-3.5 w-3.5 rotate-180";
}

export function TaskTable({
  tasks,
  sort,
  isNavigating,
  onSort,
  onEdit,
  onDelete,
}: TaskTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <Table>
        <TableHeader className="[&_tr]:border-none">
          <TableRow className="bg-zinc-900 hover:bg-zinc-900 [&>th]:px-4">
            <TableHead className="h-11 text-white text-center first:rounded-tl-lg">
              日付
            </TableHead>
            <TableHead className="h-11 text-white">
              <button
                type="button"
                onClick={() => onSort("status")}
                disabled={isNavigating}
                className="flex items-center gap-1 mx-auto"
              >
                <span>ステータス</span>
                <ArrowUpDown
                  className={sortIconClass(sort, "status")}
                  aria-hidden="true"
                />
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
            <TableHead className="h-11 text-white text-center">
              予定終了時刻
            </TableHead>
            <TableHead className="h-11 text-white text-center">
              作業開始時刻
            </TableHead>
            <TableHead className="h-11 text-white text-center">
              作業終了時刻
            </TableHead>
            <TableHead className="h-11 text-white text-center">
              指揮者
            </TableHead>
            <TableHead className="h-11 text-white text-center">備考</TableHead>
            <TableHead className="h-11 w-14 min-w-14 bg-zinc-900 text-center text-white sticky right-14 before:absolute before:inset-y-0 before:-left-3 before:w-3 before:bg-linear-to-r before:from-transparent before:to-black/20 before:pointer-events-none before:content-[''] z-10 border-l border-zinc-800">
              編集
            </TableHead>
            <TableHead className="h-11 w-14 min-w-14 bg-zinc-900 text-center text-white sticky right-0 last:rounded-tr-lg z-10">
              削除
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow
              key={task.taskId}
              className="bg-white hover:bg-transparent [&>td]:px-4"
            >
              <TableCell className="text-center">
                <Badge className={getEventDayBadgeClass(task.eventDayType)}>
                  {getEventDayLabel(task.eventDayType)}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge className={getStatusBadgeClass(task.currentStatus)}>
                  {getStatusLabel(task.currentStatus)}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                {task.fromLocationName}
              </TableCell>
              <TableCell className="text-center">
                {task.toLocationName}
              </TableCell>
              <TableCell className="text-center">{`${task.itemName} × ${task.quantity}`}</TableCell>
              <TableCell className="text-center">
                {task.scheduledStartTime}
              </TableCell>
              <TableCell className="text-center">
                {task.scheduledEndTime}
              </TableCell>
              <TableCell className="text-center">
                {task.actualStartTime ?? "-"}
              </TableCell>
              <TableCell className="text-center">
                {task.actualEndTime ?? "-"}
              </TableCell>
              <TableCell className="text-center">
                {task.leaderName ?? "-"}
              </TableCell>
              <TableCell className="text-center min-w-50">
                {task.note || "-"}
              </TableCell>
              <TableCell className="text-center bg-white sticky right-14 before:absolute before:inset-y-0 before:-left-3 before:w-3 before:bg-linear-to-r before:from-transparent before:to-black/4 before:pointer-events-none before:content-[''] z-10 border-l border-zinc-200">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(task)}
                  aria-label="編集"
                >
                  <Pencil
                    className="h-4 w-4 text-green-600"
                    aria-hidden="true"
                  />
                </Button>
              </TableCell>
              <TableCell className="text-center bg-white sticky right-0 z-10">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(task)}
                  aria-label="削除"
                >
                  <Trash2 className="h-4 w-4 text-red-600" aria-hidden="true" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {tasks.length === 0 && (
            <TableRow className="bg-white hover:bg-transparent">
              <TableCell
                colSpan={13}
                className="py-12 text-center text-sm text-zinc-500"
              >
                該当するタスクはありません
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
