"use client";

import { AlertCircle, ArrowRight, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { canChangeTaskStatus, TASK_STATUS_VALUES } from "@/features/tasks/model/task-status";
import {
  TaskStatusSegmentedControl,
  TaskStatusStepper,
} from "@/features/tasks/ui/task-status-control";
import type { AppRole } from "@/lib/auth/roles";
import { TASK_NOTE_MAX_LENGTH, type TaskStatus, type UserTask } from "../model/types";
import { updateTaskStatusAction } from "../server/actions";
import { TaskPhotoSection } from "./task-photo-section";

type TaskDetailDialogProps = {
  open: boolean;
  task: UserTask | null;
  currentRole: AppRole;
  canEditNote: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TaskDetailDialog({
  open,
  task,
  currentRole,
  canEditNote,
  onOpenChange,
}: TaskDetailDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(task?.currentStatus ?? 0);
  const [noteDraft, setNoteDraft] = useState(task?.note ?? "");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const isMobile = useIsMobile();
  const [photoEditing, setPhotoEditing] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const editingDisabled = isPending || photoEditing || photoSaving;

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

  const editableStatuses = TASK_STATUS_VALUES.filter(
    (status) =>
      status === task.currentStatus || canChangeTaskStatus(currentRole, task.currentStatus, status),
  );
  const canEditStatus = editableStatuses.some((status) => status !== task.currentStatus);

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
      toast.success("タスクを保存しました", {
        description: "変更内容が反映されました",
        position: "top-center",
        unstyled: true,
        action: { label: "閉じる", onClick: () => undefined },
        classNames: {
          toast:
            "flex h-[52px] w-full items-center gap-2.5 rounded-lg border border-[#16a34a] bg-white px-3 shadow-lg",
          icon: "flex size-[18px] shrink-0 items-center justify-center text-[#16a34a] [&>svg]:size-[18px]",
          content: "min-w-0 flex-1",
          title: "text-xs leading-4 text-[#16a34a]",
          description: "text-xs leading-[14px] text-[#16a34a]",
          actionButton: "h-7 shrink-0 rounded-md bg-[#121212] px-3 text-xs leading-4 text-white",
        },
      });
      onOpenChange(false);
    });
  };

  const descriptionId = `task-detail-description-${task.taskId}`;
  const errorId = errorMessage ? `task-detail-error-${task.taskId}` : undefined;
  const handleOpenChange = (nextOpen: boolean) => {
    if (photoSaving) return;
    if (!nextOpen && photoEditing) {
      setConfirmClose(true);
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[161px] max-h-[calc(100dvh-177px)] max-w-[330px] translate-y-0 gap-3 overflow-y-auto px-4 pt-3 pb-4 sm:top-[50%] sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:translate-y-[-50%] sm:gap-4 sm:p-6"
        aria-describedby={descriptionId}
        aria-busy={isPending}
      >
        <DialogHeader className="gap-1.5">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base leading-6">タスク詳細</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleOpenChange(false)}
              disabled={photoSaving}
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

        <div className="space-y-3 sm:space-y-6">
          <div className="flex h-10 items-center justify-center gap-3">
            <p className="min-w-0 flex-1 text-center text-lg font-bold">{task.fromLocationName}</p>
            <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-center text-lg font-bold">{task.toLocationName}</p>
          </div>

          <div>
            {canEditStatus ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#595959]">ステータス変更</p>
                <TaskStatusSegmentedControl
                  value={selectedStatus}
                  statuses={editableStatuses}
                  disabled={editingDisabled}
                  onChange={setSelectedStatus}
                />
              </div>
            ) : (
              <TaskStatusStepper status={task.currentStatus} />
            )}
          </div>

          <section className="space-y-1">
            <h3 className="text-sm font-bold text-[#595959]">タスク内容</h3>
            <div className="rounded-lg bg-[#e6e6e6] px-2 py-1">
              <div className="grid min-h-8 grid-cols-[88px_1fr] items-center border-b border-[#bababa] py-1.5">
                <p className="text-[11px] leading-[14px] text-[#595959]">物品名・個数</p>
                <p className="min-w-0 text-sm">
                  {task.itemName}×{task.quantity}
                </p>
              </div>
              <div className="grid min-h-8 grid-cols-[88px_1fr] items-center border-b border-[#bababa] py-1.5">
                <p className="text-[11px] leading-[14px] text-[#595959]">予定作業時間</p>
                <p className="min-w-0 text-sm">{`${task.scheduledStartTime}〜${task.scheduledEndTime}`}</p>
              </div>
              <div className="grid min-h-8 grid-cols-[88px_1fr] items-center py-1.5">
                <p className="text-[11px] leading-[14px] text-[#595959]">担当者</p>
                <p className="min-w-0 text-sm">{task.leaderName ?? "未設定"}</p>
              </div>
            </div>
          </section>

          <section className="space-y-1">
            <h3 className="text-sm font-bold text-[#595959]">タスク備考</h3>
            {canEditNote ? (
              <Textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                maxLength={TASK_NOTE_MAX_LENGTH}
                disabled={editingDisabled}
                aria-label="タスク備考"
                placeholder="補足があれば記入してください"
                className="min-h-[76px] resize-none bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
              />
            ) : (
              <div className="min-h-[76px] whitespace-pre-wrap rounded-lg bg-[#e6e6e6] px-3 py-2 text-sm leading-5 text-[#595959]">
                {task.note?.trim() || "なし"}
              </div>
            )}
          </section>

          {isMobile && open ? (
            <TaskPhotoSection
              taskId={task.taskId}
              completed={task.currentStatus === 3}
              disabled={isPending}
              hideActionsUntilDirty={canEditStatus || canEditNote}
              onEditingChange={setPhotoEditing}
              onSavingChange={setPhotoSaving}
            />
          ) : null}

          {errorMessage ? (
            <p
              id={errorId}
              role="alert"
              aria-live="assertive"
              className="flex items-center gap-1 text-xs text-red-600"
            >
              <AlertCircle className="size-3.5" aria-hidden="true" />
              {errorMessage}
            </p>
          ) : null}

          {(canEditStatus || canEditNote) && !photoEditing ? (
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="h-11 flex-1"
                onClick={handleReset}
                disabled={editingDisabled}
              >
                {isMobile ? "変更を戻す" : "リセット"}
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 bg-[#0017c1] hover:bg-[#0017c1]/90"
                onClick={handleSave}
                disabled={editingDisabled || (canEditNote && isNoteTooLong)}
                aria-describedby={errorId}
              >
                {isPending ? "保存中..." : "変更保存"}
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>写真の編集を終了しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              未保存の変更は失われます。保存結果が不明な場合は、先に写真欄で確認してください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>編集を続ける</AlertDialogCancel>
            <AlertDialogAction onClick={() => onOpenChange(false)}>編集を終了</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
