"use client";

import { AlertCircle } from "lucide-react";
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
import type { AdminLocation } from "../model/types";
import { deleteLocationAction } from "../server/actions";

type LocationDeleteDialogProps = {
  open: boolean;
  location: AdminLocation | null;
  onOpenChange: (open: boolean) => void;
};

function getLabel(location: AdminLocation) {
  return location.depth === 0 ? "エリア名" : "場所名";
}

export function LocationDeleteDialog({
  open,
  location,
  onOpenChange,
}: LocationDeleteDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setErrorMessage("");
    }

    onOpenChange(nextOpen);
  };

  if (!location) {
    return null;
  }

  const handleDelete = () => {
    setErrorMessage("");

    startTransition(async () => {
      const result = await deleteLocationAction(location.locationId);
      if (!result.ok) {
        setErrorMessage(result.message ?? "削除に失敗しました");
        return;
      }

      handleOpenChange(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-[543px] gap-0 rounded-[14px] border-none p-9 shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">
        <AlertDialogTitle className="sr-only">場所の削除確認</AlertDialogTitle>

        <div className="space-y-8">
          <div className="space-y-1">
            <Label className="text-xs font-normal text-zinc-500">{getLabel(location)}</Label>
            <div className="flex h-[42px] items-center rounded-[10px] border border-zinc-200 bg-white px-[13px] text-base text-[#0a0a0a]">
              {location.name}
            </div>
          </div>

          <p className="px-6 text-center text-base font-normal text-black">この項目を削除しますか？</p>

          {errorMessage ? (
            <p className="flex items-center justify-center gap-1 text-sm text-[#c91111]">
              <AlertCircle className="h-4 w-4" />
              {errorMessage}
            </p>
          ) : null}
        </div>

        <AlertDialogFooter className="mt-8 gap-3 sm:justify-end">
          <AlertDialogCancel className="h-9 rounded-[10px] border-none px-4 text-sm font-normal text-[#364153] shadow-none hover:bg-zinc-100 hover:text-[#364153]">
            キャンセル
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-9 rounded-[10px] bg-[#c91111] px-6 text-sm font-normal text-white hover:bg-[#b10f0f]"
            onClick={(event) => {
              event.preventDefault();
              if (!isPending) {
                handleDelete();
              }
            }}
          >
            {isPending ? "削除中..." : "削除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
