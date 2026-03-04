"use client";

import { AlertCircle, Triangle } from "lucide-react";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import type { AdminTask } from "../model/types";
import { deleteTaskAction } from "../server/actions";

type TaskDeleteDialogProps = {
  open: boolean;
  task: AdminTask | null;
  onOpenChange: (open: boolean) => void;
};

export function TaskDeleteDialog({ open, task, onOpenChange }: TaskDeleteDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");

  if (!task) {
    return null;
  }

  const handleDelete = () => {
    setErrorMessage("");

    startTransition(async () => {
      const result = await deleteTaskAction(task.taskId);
      if (!result.ok) {
        setErrorMessage(result.message ?? "削除に失敗しました");
        return;
      }

      onOpenChange(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-134 sm:max-w-134 rounded-xl">
        <AlertDialogTitle className="sr-only">タスクの削除確認</AlertDialogTitle>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-500 font-normal">From (搬入元)</Label>
              <div className="flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
                {task.fromLocationName}
              </div>
            </div>
            <div className="mb-3 text-zinc-400">
              <Triangle className="h-4 w-4 rotate-90 fill-current" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-500 font-normal">To (搬入先)</Label>
              <div className="flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
                {task.toLocationName}
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <Label className="text-xs text-zinc-500 font-normal">物品名・数量</Label>
            <div className="flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
              {`${task.itemName} × ${task.quantity}`}
            </div>
          </div>

          <p className="text-sm font-medium text-zinc-900 pt-6 px-1">この項目を削除しますか？</p>

          {errorMessage ? (
            <p className="flex items-center justify-center gap-1 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {errorMessage}
            </p>
          ) : null}
        </div>

        <AlertDialogFooter className="justify-end">
          <AlertDialogCancel className="border-none bg-transparent shadow-none hover:bg-transparent">
            キャンセル
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              if (!isPending) {
                handleDelete();
              }
            }}
            className="bg-red-700 text-white hover:bg-red-800"
          >
            {isPending ? "削除中..." : "削除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
