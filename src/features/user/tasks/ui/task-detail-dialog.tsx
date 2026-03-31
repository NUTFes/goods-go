"use client";

import { AlertCircle, Triangle, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getStatusDotClass, getStatusLabel } from "../model/mappers";
import { TASK_NOTE_MAX_LENGTH, type TaskStatus, type UserTask } from "../model/types";
import { updateTaskStatusAction } from "../server/actions";

type TaskDetailDialogProps = {
  open: boolean;
  task: UserTask | null;
  canEditStatus: boolean;
  canEditNote: boolean;
  onOpenChange: (open: boolean) => void;
};

function statusOptions(): TaskStatus[] {
  return [0, 1, 2];
}

export function TaskDetailDialog({
  open,
  task,
  canEditStatus,
  canEditNote,
  onOpenChange,
}: TaskDetailDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(task?.currentStatus ?? 0);
  const [noteDraft, setNoteDraft] = useState(task?.note ?? "");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const isDirty = useMemo(() => {
    if (!task) {
      return false;
    }
    const hasStatusChange = selectedStatus !== task.currentStatus;
    if (!canEditNote) {
      return hasStatusChange;
    }
    const currentNote = task.note?.trim() ?? "";
    const draftNote = noteDraft.trim();
    return hasStatusChange || currentNote !== draftNote;
  }, [canEditNote, noteDraft, selectedStatus, task]);

  const isNoteTooLong = noteDraft.trim().length > TASK_NOTE_MAX_LENGTH;

  if (!task) {
    return null;
  }

  const handleReset = () => {
    setSelectedStatus(task.currentStatus);
    setNoteDraft(task.note ?? "");
    setErrorMessage("");
  };

  const handleSave = () => {
    if (!isDirty) {
      onOpenChange(false);
      return;
    }

    const hasStatusChange = selectedStatus !== task.currentStatus;
    const currentNote = task.note?.trim() ?? "";
    const nextNote = noteDraft.trim();
    const hasNoteChange = canEditNote && currentNote !== nextNote;

    setErrorMessage("");
    startTransition(async () => {
      const result = await updateTaskStatusAction(
        task.taskId,
        selectedStatus,
        canEditNote ? noteDraft : undefined,
      );
      if (!result.ok) {
        setErrorMessage(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(
        hasStatusChange && hasNoteChange
          ? "ステータスと備考を更新しました"
          : hasStatusChange
            ? "ステータスを更新しました"
            : "備考を更新しました",
      );
      onOpenChange(false);
    });
  };

  const descriptionId = `task-detail-description-${task.taskId}`;
  const errorId = errorMessage ? `task-detail-error-${task.taskId}` : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="overflow-y-scroll max-h-screen"
        aria-describedby={descriptionId}
        aria-busy={isPending}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>タスク詳細</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label="閉じる"
            >
              <X className="size-4" />
            </Button>
          </div>
          <DialogDescription id={descriptionId} className="sr-only">
            タスクの詳細情報を表示し、権限がある場合はステータスや備考を変更できます。
          </DialogDescription>
          <Separator />
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3.5">
            <p className="font-bold sm:text-lg">{task.fromLocationName}</p>
            <Triangle className="size-4 rotate-180 fill-[#121212]" aria-hidden="true" />
            <p className="sm:text-lg font-bold ">{task.toLocationName}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#e5e5e5] bg-[#e6e6e6] p-3">
              <p className="text-sm font-semibold text-[#595959]">
                {canEditStatus ? "ステータス変更" : "ステータス"}
              </p>
              <Select
                value={String(selectedStatus)}
                onValueChange={(value) => setSelectedStatus(Number(value) as TaskStatus)}
                disabled={!canEditStatus}
              >
                <SelectTrigger
                  className="mt-2 h-9 w-full rounded-xl bg-white disabled:cursor-not-allowed disabled:opacity-70"
                  aria-label="タスクステータス"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {statusOptions().map((status) => (
                    <SelectItem key={status} value={String(status)}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-block h-2.5 w-2.5 rounded-full",
                            getStatusDotClass(status),
                          )}
                        />
                        <span>{getStatusLabel(status)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-[#e5e5e5] bg-[#e6e6e6] p-3">
              <p className="text-sm font-semibold text-[#595959]">物品種類・数量</p>
              <p className="mt-2 text-sm text-black">
                <span>{task.itemName}</span>
                <span className="mx-1">×</span>
                <span>{task.quantity}</span>
              </p>
            </div>
          </div>

          <section className="space-y-3">
            <h3 className="text-base font-bold">タスク情報</h3>
            <div className="rounded-xl bg-[#e6e6e6] p-3">
              <div className="flex gap-12">
                <div>
                  <p className="text-sm font-semibold text-[#595959]">作業予定時刻</p>
                  <p className="mt-1.5 text-sm">{`${task.scheduledStartTime}〜${task.scheduledEndTime}`}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-[#595959]">担当者</p>
                <p className="mt-1.5 text-sm">{task.leaderName ?? "未設定"}</p>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-[#595959]">タスク備考</p>
                <div className="mt-1.5 space-y-2">
                  <Textarea
                    value={!canEditNote && !task.note?.trim() ? "なし" : noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    maxLength={TASK_NOTE_MAX_LENGTH}
                    disabled={!canEditNote || isPending}
                    aria-label="タスク備考"
                    placeholder={canEditNote ? "補足があれば記入してください" : ""}
                    className="min-h-24 bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
              </div>
            </div>
          </section>

          {errorMessage ? (
            <p
              id={errorId}
              role="alert"
              aria-live="assertive"
              className="flex items-center gap-1 text-xs text-red-600"
            >
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {errorMessage}
            </p>
          ) : null}

          {canEditStatus ? (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 border-[#121212]"
                onClick={handleReset}
                disabled={isPending}
              >
                リセット
              </Button>
              <Button
                type="button"
                className="h-10 bg-[#121212] hover:bg-[#121212]/90"
                onClick={handleSave}
                disabled={isPending || (canEditNote && isNoteTooLong)}
                aria-describedby={errorId}
              >
                {isPending ? "保存中..." : "変更保存"}
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
