"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import { TASK_PHOTO_ACCEPT, TASK_PHOTO_LIMIT } from "../model/convert-task-photo";
import { useTaskPhotos } from "../model/use-task-photos";

function DraftPreview({ jpeg, name }: { jpeg: Blob; name: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(jpeg);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [jpeg]);
  return url ? <img src={url} alt={name} className="size-full rounded-lg object-cover" /> : null;
}

function SavedPhotoPreview({ url, number }: { url: string | null; number: number }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed)
    return (
      <span className="flex h-full items-center justify-center text-center text-xs">
        表示できません。再読み込みしてください。
      </span>
    );
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`写真${number}を開く`}>
      <img
        src={url}
        alt={`写真${number}`}
        className="size-full rounded-lg object-cover"
        onError={() => setFailed(true)}
      />
    </a>
  );
}

export function TaskPhotoSection({
  taskId,
  completed,
  disabled,
  hideActionsUntilDirty,
  onEditingChange,
  onSavingChange,
}: {
  taskId: string;
  completed: boolean;
  disabled: boolean;
  hideActionsUntilDirty: boolean;
  onEditingChange: (editing: boolean) => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const photos = useTaskPhotos(taskId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputId = useId();
  const readOnly = completed || photos.snapshot?.completed;
  const locked = disabled || photos.loading || photos.saving || photos.uncertain;
  const count =
    (photos.snapshot?.photos.filter((photo) => !photos.deletions.includes(photo.photo_id)).length ??
      0) + photos.drafts.length;
  const canSave =
    photos.dirty &&
    count <= TASK_PHOTO_LIMIT &&
    !photos.converting &&
    photos.drafts.every((photo) => photo.jpeg);

  useEffect(() => {
    onEditingChange(photos.dirty || photos.converting || photos.uncertain);
    return () => onEditingChange(false);
  }, [onEditingChange, photos.dirty, photos.converting, photos.uncertain]);
  useEffect(() => {
    onSavingChange(photos.saving);
    return () => onSavingChange(false);
  }, [onSavingChange, photos.saving]);

  return (
    <section
      className="space-y-3"
      aria-label="完了写真"
      aria-busy={photos.loading || photos.saving}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-muted-foreground">完了写真</h3>
        <span className="sr-only">
          {photos.snapshot ? count : "—"} / {TASK_PHOTO_LIMIT}枚
        </span>
      </div>
      {photos.loading ? (
        <p className="flex items-center gap-2 text-sm">
          <Spinner />
          写真を読み込み中…
        </p>
      ) : null}
      <ul className="grid grid-cols-4 gap-2.5">
        {!readOnly && photos.snapshot ? (
          <li className="flex min-h-[78px] items-end">
            <input
              id={inputId}
              type="file"
              multiple
              accept={TASK_PHOTO_ACCEPT}
              className="peer sr-only"
              disabled={locked || photos.converting || count >= TASK_PHOTO_LIMIT}
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                event.currentTarget.value = "";
                if (files.length) photos.add(files);
              }}
            />
            <label
              htmlFor={inputId}
              className="flex size-[68px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-muted-foreground text-muted-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span className="text-[11px]">画像追加</span>
            </label>
          </li>
        ) : null}
        {photos.snapshot?.photos.map((photo, index) => {
          const deleting = photos.deletions.includes(photo.photo_id);
          return (
            <li key={photo.photo_id} className="relative min-h-[78px] min-w-0 pt-2.5">
              <div className={`size-[68px] rounded-lg bg-muted ${deleting ? "opacity-40" : ""}`}>
                <SavedPhotoPreview key={photo.url} url={photo.url} number={index + 1} />
              </div>
              {!readOnly ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant={deleting ? "outline" : "default"}
                  className="absolute -right-2.5 top-0 size-5 rounded-full"
                  disabled={locked}
                  onClick={() => photos.toggleDeletion(photo.photo_id)}
                  aria-label={
                    deleting
                      ? `写真${index + 1}の削除を取り消す`
                      : `写真${index + 1}を削除予定にする`
                  }
                >
                  {deleting ? <RotateCcw className="size-3.5" /> : <X className="size-3.5" />}
                </Button>
              ) : null}
              {deleting ? <p className="mt-1 text-xs text-destructive">削除予定</p> : null}
            </li>
          );
        })}
        {photos.drafts.map((photo) => (
          <li key={photo.photoId} className="relative min-h-[78px] min-w-0 pt-2.5">
            <div className="flex size-[68px] items-center justify-center rounded-lg bg-muted">
              {photo.jpeg ? (
                <DraftPreview jpeg={photo.jpeg} name={photo.file.name} />
              ) : photo.error ? (
                <span className="px-1 text-center text-xs">変換できません</span>
              ) : (
                <Spinner aria-label={`${photo.file.name}を変換中`} />
              )}
            </div>
            {!readOnly ? (
              <Button
                type="button"
                size="icon-sm"
                className="absolute -right-2.5 top-0 size-5 rounded-full"
                disabled={locked}
                onClick={() => photos.remove(photo.photoId)}
                aria-label={`${photo.file.name}を取り消す`}
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
            <p className="mt-1 truncate text-[11px] text-muted-foreground" title={photo.file.name}>
              未保存：{photo.file.name}
            </p>
            {photo.error ? (
              <p role="alert" className="mt-1 break-words text-xs text-destructive">
                {photo.error}
              </p>
            ) : null}
            {!readOnly && photo.retryable && !photo.jpeg ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 h-7 px-1 text-xs"
                disabled={locked || photos.converting}
                onClick={() => photos.retry(photo.photoId)}
              >
                再試行
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {!photos.loading && photos.snapshot && count === 0 ? (
        <p className="text-xs text-muted-foreground">写真はありません。写真なしでも構いません。</p>
      ) : null}
      {readOnly ? (
        <p className="text-xs text-muted-foreground">完了したタスクの写真は変更できません。</p>
      ) : null}
      {photos.error ? (
        <p role="alert" className="text-sm text-destructive">
          {photos.error}
        </p>
      ) : null}
      {photos.error || photos.uncertain ? (
        <div className="flex flex-wrap gap-2">
          {photos.error ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={locked || photos.converting}
              onClick={() => void photos.reload()}
            >
              写真を再読み込み
            </Button>
          ) : null}
          {photos.uncertain ? (
            <Button
              type="button"
              size="sm"
              disabled={disabled || photos.saving}
              onClick={() => void photos.save()}
            >
              保存結果を確認
            </Button>
          ) : null}
        </div>
      ) : null}
      {!readOnly && (!hideActionsUntilDirty || photos.dirty) ? (
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            className="h-11 flex-1"
            disabled={locked || !photos.dirty}
            onClick={photos.reset}
          >
            変更を戻す
          </Button>
          <Button
            type="button"
            className="h-11 flex-1 bg-[#0017c1] hover:bg-[#0017c1]/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            disabled={locked || !canSave}
            onClick={() => (photos.deletions.length ? setConfirmDelete(true) : void photos.save())}
          >
            {photos.saving ? "保存中…" : "変更保存"}
          </Button>
        </div>
      ) : photos.dirty && !photos.uncertain ? (
        <Button type="button" variant="secondary" disabled={photos.saving} onClick={photos.reset}>
          未保存の変更を取り消す
        </Button>
      ) : null}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>写真を削除して保存しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              保存すると{photos.deletions.length}枚の写真が削除されます。保存後は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction
              disabled={locked || readOnly || !canSave}
              onClick={() => void photos.save()}
            >
              削除して保存
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
