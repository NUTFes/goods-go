"use client";

import { Funnel } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";
import { userTaskQueryStatesParsers } from "../model/query-state";
import type {
  TaskStatus,
  UserTask,
  UserTaskFilterOptions,
  UserTaskFilterState,
} from "../model/types";
import { TaskCard } from "./task-card";
import { TaskDetailDialog } from "./task-detail-dialog";
import { TaskFilterSheet } from "./task-filter-sheet";
import { UserTaskHeader } from "./user-task-header";

type TaskListPageViewProps = {
  currentUser: {
    userId: string;
    name: string;
    role: AppRole;
  };
  tasks: UserTask[];
  filterOptions: UserTaskFilterOptions;
};

function isTaskStatus(value: number): value is TaskStatus {
  return value === 0 || value === 1 || value === 2;
}

export function TaskListPageView({ currentUser, tasks, filterOptions }: TaskListPageViewProps) {
  const router = useRouter();
  const [qs, setQs] = useQueryStates(userTaskQueryStatesParsers, { shallow: false });
  const [isPending, startTransition] = useTransition();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<UserTaskFilterState>({
    day: "0",
    statuses: [],
    fromLocationId: "",
    toLocationId: "",
    itemIds: [],
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const filters: UserTaskFilterState = useMemo(
    () => ({
      day: qs.day,
      statuses: qs.statuses.filter(isTaskStatus),
      fromLocationId: qs.fromLocationId,
      toLocationId: qs.toLocationId,
      itemIds: qs.itemIds.filter((itemId) => itemId.length > 0),
    }),
    [qs.day, qs.fromLocationId, qs.itemIds, qs.statuses, qs.toLocationId],
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.taskId === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const canEditStatus =
    currentUser.role === APP_ROLES.ADMIN || currentUser.role === APP_ROLES.LEADER;
  const canEditNote = currentUser.role === APP_ROLES.ADMIN;

  const handleDayChange = (day: "0" | "1" | "2") => {
    startTransition(() => {
      setQs({ day });
    });
  };

  const handleApplyFilter = (nextFilters: UserTaskFilterState) => {
    startTransition(() => {
      setQs({
        statuses: nextFilters.statuses,
        fromLocationId: nextFilters.fromLocationId,
        toLocationId: nextFilters.toLocationId,
        itemIds: nextFilters.itemIds,
      });
    });
  };

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <main className="min-h-dvh bg-[#f3f4f6]">
      <h1 className="sr-only">タスク一覧</h1>

      <UserTaskHeader
        currentDay={filters.day}
        currentRole={currentUser.role}
        currentUserName={currentUser.name}
        onDayChange={handleDayChange}
      />

      <section
        className="mx-auto w-full max-w-3xl space-y-4 px-3 pb-10 pt-4 sm:px-4"
        aria-labelledby="task-list-heading"
        aria-busy={isPending}
      >
        <h2 id="task-list-heading" className="sr-only">
          表示中のタスク一覧
        </h2>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-xl border-[#121212] text-xs"
            onClick={handleRefresh}
            disabled={isPending}
          >
            {isPending ? <Spinner className="size-3.5" aria-label="更新中" /> : null}
            {isPending ? "更新中..." : "更新"}
          </Button>
          <Button
            type="button"
            size="lg"
            className="rounded-xl text-xs hover:bg-[#121212]/90"
            aria-haspopup="dialog"
            aria-expanded={isFilterOpen}
            aria-controls="task-filter-sheet"
            onClick={() => {
              setFilterDraft(filters);
              setIsFilterOpen(true);
            }}
          >
            <Funnel className="size-3.5" aria-hidden="true" />
            絞り込む
          </Button>
        </div>

        {tasks.length > 0 ? (
          <ul role="list" className="space-y-2">
            {tasks.map((task) => (
              <li key={task.taskId}>
                <TaskCard task={task} onClick={() => setSelectedTaskId(task.taskId)} />
              </li>
            ))}
          </ul>
        ) : null}

        {!isPending && tasks.length === 0 ? (
          <div
            className="rounded-lg border border-[#e5e5e5] bg-white px-4 py-8 shadow-sm"
            role="status"
            aria-live="polite"
          >
            <p className="text-center text-sm text-[#737373]">該当するタスクはありません</p>
          </div>
        ) : null}
      </section>

      {isFilterOpen ? (
        <TaskFilterSheet
          open={isFilterOpen}
          onOpenChange={setIsFilterOpen}
          draft={filterDraft}
          onDraftChange={setFilterDraft}
          filterOptions={filterOptions}
          onApply={handleApplyFilter}
        />
      ) : null}

      <TaskDetailDialog
        key={`${selectedTask?.taskId ?? "none"}:${selectedTask?.currentStatus ?? "-1"}:${selectedTask?.note ?? ""}`}
        open={selectedTask !== null}
        task={selectedTask}
        canEditStatus={canEditStatus}
        canEditNote={canEditNote}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTaskId(null);
          }
        }}
      />
    </main>
  );
}
