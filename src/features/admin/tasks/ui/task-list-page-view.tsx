"use client";

import { CirclePlus } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { taskListQueryStatesParsers } from "../model/query-state";
import type {
  AdminTask,
  TaskFilterOptions,
  TaskFilterState,
  TaskListQueryState,
  TaskSortKey,
} from "../model/types";
import { TaskDeleteDialog } from "./task-delete-dialog";
import { TaskFilterBar } from "./task-filter-bar";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskTable } from "./task-table";

type TaskListPageViewProps = {
  tasks: AdminTask[];
  filterOptions: TaskFilterOptions;
};

export function TaskListPageView({ tasks, filterOptions }: TaskListPageViewProps) {
  const [qs, setQs] = useQueryStates(taskListQueryStatesParsers, {
    shallow: false,
  });
  const [isPending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<AdminTask | null>(null);

  const handleFilterChange = (nextFilters: TaskFilterState) => {
    startTransition(() => {
      setQs(nextFilters);
    });
  };

  const handleSortChange = (key: TaskSortKey) => {
    startTransition(() => {
      const nextSortDirection =
        qs.sortKey === key ? (qs.sortDirection === "asc" ? "desc" : "asc") : "asc";

      setQs({ sortKey: key, sortDirection: nextSortDirection });
    });
  };

  const filters: TaskFilterState = {
    day: qs.day,
    status: qs.status,
    itemId: qs.itemId,
    leaderUserId: qs.leaderUserId,
    fromLocationId: qs.fromLocationId,
    toLocationId: qs.toLocationId,
  };

  const sort: TaskListQueryState["sort"] = {
    key: qs.sortKey,
    direction: qs.sortDirection as "asc" | "desc",
  };

  return (
    <main className="px-16 py-8">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            type="button"
            className="bg-black text-white hover:bg-zinc-800"
            disabled={isPending}
            onClick={() => setCreateOpen(true)}
          >
            <CirclePlus className="h-4 w-4" />
            タスクを追加
          </Button>
        </div>

        <TaskFilterBar
          filters={filters}
          filterOptions={filterOptions}
          onChange={handleFilterChange}
        />

        <TaskTable
          tasks={tasks}
          sort={sort}
          isNavigating={isPending}
          onSort={handleSortChange}
          onEdit={(task) => setEditingTask(task)}
          onDelete={(task) => setDeletingTask(task)}
        />
      </div>

      <TaskFormDialog
        mode="create"
        open={createOpen}
        filterOptions={filterOptions}
        onOpenChange={setCreateOpen}
      />

      <TaskFormDialog
        mode="edit"
        open={editingTask !== null}
        task={editingTask}
        filterOptions={filterOptions}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTask(null);
          }
        }}
      />

      <TaskDeleteDialog
        open={deletingTask !== null}
        task={deletingTask}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingTask(null);
          }
        }}
      />
    </main>
  );
}
