"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import type { AdminItem } from "../model/types";
import { deleteItemAction } from "../server/actions";

type ItemDeleteDialogProps = {
  open: boolean;
  item: AdminItem | null;
  onOpenChange: (open: boolean) => void;
};

export function ItemDeleteDialog({ open, item, onOpenChange }: ItemDeleteDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setErrorMessage("");
  }, [item, open]);

  if (!item) {
    return null;
  }

  const handleDelete = () => {
    setErrorMessage("");

    startTransition(async () => {
      const result = await deleteItemAction(item.itemId);
      if (!result.ok) {
        setErrorMessage(result.message ?? "削除に失敗しました");
        return;
      }

      onOpenChange(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-xl rounded-xl">
        <AlertDialogTitle className="sr-only">物品の削除確認</AlertDialogTitle>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-normal text-zinc-500">物品名</Label>
            <div className="flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
              {item.name}
            </div>
          </div>

          <p className="px-1 pt-2 text-sm font-medium text-zinc-900">この物品を削除しますか？</p>

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
