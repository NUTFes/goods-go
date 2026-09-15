"use client";

import { ArrowRight, ChevronLeft, ChevronRight, ImageIcon, Package, UserRound } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useTaskPhotoViewer } from "../model/use-task-photo-viewer";
import type { AdminTask } from "../model/types";

type TaskPhotoConfirmDialogProps = {
  open: boolean;
  task: AdminTask | null;
  onOpenChange: (open: boolean) => void;
};

function PhotoViewer({ viewer }: { viewer: ReturnType<typeof useTaskPhotoViewer> }) {
  const total = viewer.photos.length;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg bg-zinc-100">
        <AspectRatio ratio={16 / 9}>
          <div className="flex size-full items-center justify-center">
            {viewer.loadingList || viewer.loadingCurrent ? <Spinner className="size-6" /> : null}
            {!viewer.loadingList && !viewer.loadingCurrent && viewer.currentUrl && !viewer.error ? (
              <img
                key={viewer.currentUrl}
                src={viewer.currentUrl}
                alt={`確認写真${viewer.currentIndex + 1}`}
                className="size-full object-contain"
                onError={viewer.reportCurrentPhotoError}
              />
            ) : null}
            {!viewer.loadingList && !viewer.loadingCurrent && total === 0 && !viewer.error ? (
              <p className="text-sm text-zinc-500">写真はありません</p>
            ) : null}
            {!viewer.loadingList && !viewer.loadingCurrent && viewer.error ? (
              <div className="space-y-2 text-center">
                <p className="text-sm text-red-600">{viewer.error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={viewer.retryCurrentPhoto}
                >
                  再読み込み
                </Button>
              </div>
            ) : null}
          </div>
        </AspectRatio>

        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          className="absolute left-3 top-1/2 rounded-full bg-white/90 -translate-y-1/2"
          disabled={viewer.currentIndex === 0 || viewer.loadingList}
          onClick={() => viewer.selectPhoto(viewer.currentIndex - 1)}
          aria-label="前の写真"
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          className="absolute right-3 top-1/2 rounded-full bg-white/90 -translate-y-1/2"
          disabled={viewer.currentIndex >= total - 1 || viewer.loadingList}
          onClick={() => viewer.selectPhoto(viewer.currentIndex + 1)}
          aria-label="次の写真"
        >
          <ChevronRight />
        </Button>
        <span className="absolute right-3 bottom-2 rounded bg-black/65 px-2 py-0.5 text-xs text-white">
          {total === 0 ? 0 : viewer.currentIndex + 1}/{total}
        </span>
      </div>

      {total > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="写真一覧">
          {viewer.photos.map((photo, index) => {
            const signedPhoto = viewer.signedPhotos[photo.photoId];
            return (
              <button
                key={photo.photoId}
                type="button"
                className={cn(
                  "flex h-[61px] w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-zinc-100 text-xs text-zinc-500",
                  index === viewer.currentIndex ? "border-zinc-900" : "border-transparent",
                )}
                onClick={() => viewer.selectPhoto(index)}
                aria-label={`写真${index + 1}を表示`}
                aria-current={index === viewer.currentIndex}
              >
                {signedPhoto ? (
                  <img
                    src={signedPhoto.url}
                    alt=""
                    className="size-full object-cover"
                    aria-hidden="true"
                  />
                ) : (
                  `${index + 1}`
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function TaskInformation({ task }: { task: AdminTask }) {
  return (
    <div className="space-y-3 text-sm">
      <section className="space-y-1.5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Package className="size-4" aria-hidden="true" />
          物品名・個数
        </h3>
        <p className="rounded-lg bg-zinc-100 px-3 py-2">{`${task.itemName} × ${task.quantity}`}</p>
      </section>
      <section className="space-y-1.5">
        <h3 className="flex items-center gap-2 font-semibold">
          <UserRound className="size-4" aria-hidden="true" />
          指揮者
        </h3>
        <p className="rounded-lg bg-zinc-100 px-3 py-2">{task.leaderName ?? "-"}</p>
      </section>
      <section className="space-y-1.5">
        <h3 className="font-semibold">備考</h3>
        <p className="min-h-16 whitespace-pre-wrap rounded-lg bg-zinc-100 px-3 py-2">
          {task.note || "-"}
        </p>
      </section>
    </div>
  );
}

export function TaskPhotoConfirmDialog({ open, task, onOpenChange }: TaskPhotoConfirmDialogProps) {
  const viewer = useTaskPhotoViewer(task?.taskId ?? "", open && task !== null);

  if (!task) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] w-[560px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[14px] p-6 sm:max-w-[560px]">
        <DialogHeader className="border-b pb-4 pr-8">
          <DialogTitle className="flex items-center gap-5">
            <span className="truncate">{task.fromLocationName}</span>
            <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
            <span className="truncate">{task.toLocationName}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            タスクに登録された完了写真を確認します
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ImageIcon className="size-4" aria-hidden="true" />
            確認写真
          </h2>
          <PhotoViewer viewer={viewer} />
        </section>

        <TaskInformation task={task} />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
