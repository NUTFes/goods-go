"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { convertTaskPhoto, TaskPhotoConversionError, TASK_PHOTO_LIMIT } from "./convert-task-photo";
import { loadTaskPhotos, photoSaveMessage, uploadTaskPhotos, type PhotoDraft } from "./task-photos";

export function useTaskPhotos(taskId: string) {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadTaskPhotos>> | null>(null);
  const [drafts, setDrafts] = useState<PhotoDraft[]>([]);
  const [deletions, setDeletions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(false);
  const draftList = useRef<PhotoDraft[]>([]);
  const working = useRef(false);

  function replaceDrafts(next: PhotoDraft[]) {
    draftList.current = next;
    setDrafts(next);
  }

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    loadTaskPhotos(createClient(), taskId)
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setError("写真を取得できませんでした。再読み込みしてください。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      alive.current = false;
    };
  }, [taskId]);

  async function reload() {
    if (working.current || uncertain) return;
    setLoading(true);
    setError("");
    try {
      const data = await loadTaskPhotos(createClient(), taskId);
      if (alive.current) setSnapshot(data);
    } catch {
      if (alive.current) setError("写真を取得できませんでした。再読み込みしてください。");
    } finally {
      if (alive.current) setLoading(false);
    }
  }

  async function convert(selected: PhotoDraft[]) {
    working.current = true;
    setConverting(true);
    try {
      for (const draft of selected) {
        if (!alive.current) break;
        if (!draftList.current.some((photo) => photo.photoId === draft.photoId)) continue;
        let result: Partial<PhotoDraft>;
        try {
          result = { jpeg: await convertTaskPhoto(draft.file), error: undefined, retryable: false };
        } catch (cause) {
          result = {
            error: cause instanceof Error ? cause.message : "写真を変換できませんでした。",
            retryable: cause instanceof TaskPhotoConversionError && cause.retryable,
          };
        }
        if (alive.current) {
          replaceDrafts(
            draftList.current.map((photo) =>
              photo.photoId === draft.photoId ? { ...photo, ...result } : photo,
            ),
          );
        }
      }
    } finally {
      working.current = false;
      if (alive.current) setConverting(false);
    }
  }

  function add(files: File[]) {
    if (!snapshot || snapshot.completed || loading || working.current || uncertain) return;
    const remaining =
      TASK_PHOTO_LIMIT -
      (snapshot.photos.filter((photo) => !deletions.includes(photo.photo_id)).length +
        draftList.current.length);
    if (files.length > remaining) {
      setError(`写真は最大8枚です。あと${Math.max(0, remaining)}枚選べます。`);
      return;
    }
    const selected = files.map((file) => ({ photoId: crypto.randomUUID(), file }));
    setError("");
    replaceDrafts([...draftList.current, ...selected]);
    void convert(selected);
  }

  function retry(photoId: string) {
    if (working.current || uncertain || snapshot?.completed) return;
    const photo = draftList.current.find((draft) => draft.photoId === photoId);
    if (!photo?.retryable || photo.jpeg) return;
    const pending = { ...photo, error: undefined, retryable: false };
    replaceDrafts(draftList.current.map((draft) => (draft.photoId === photoId ? pending : draft)));
    void convert([pending]);
  }

  function remove(photoId: string) {
    if (saving || uncertain || snapshot?.completed) return;
    replaceDrafts(draftList.current.filter((photo) => photo.photoId !== photoId));
  }

  function toggleDeletion(photoId: string) {
    if (saving || uncertain || snapshot?.completed) return;
    const count =
      (snapshot?.photos.filter((photo) => !deletions.includes(photo.photo_id)).length ?? 0) +
      draftList.current.length;
    if (deletions.includes(photoId) && count >= TASK_PHOTO_LIMIT) {
      setError("写真は最大8枚です。追加した写真を取り消してから、削除予定を戻してください。");
      return;
    }
    setDeletions((ids) =>
      ids.includes(photoId) ? ids.filter((id) => id !== photoId) : [...ids, photoId],
    );
  }

  function reset() {
    if (saving || uncertain) return;
    replaceDrafts([]);
    setDeletions([]);
    setError("");
  }

  async function save() {
    if (working.current || loading || (!uncertain && snapshot?.completed)) return;
    if (!draftList.current.length && !deletions.length) return;
    if (draftList.current.some((photo) => !photo.jpeg)) return;
    working.current = true;
    setSaving(true);
    setError("");
    const additions = [...draftList.current];
    const addIds = additions.map((photo) => photo.photoId);
    const deleteIds = [...deletions];
    let rpcSent = uncertain;
    let confirmed = false;

    try {
      const client = createClient();
      if (uncertain) {
        const data = await loadTaskPhotos(client, taskId);
        if (!alive.current) return;
        setSnapshot(data);
        const ids = new Set(data.photos.map((photo) => photo.photo_id));
        confirmed = addIds.every((id) => ids.has(id)) && deleteIds.every((id) => !ids.has(id));
      } else {
        const failures = await uploadTaskPhotos(client, taskId, additions);
        if (!alive.current) return;
        replaceDrafts(additions.map((photo) => ({ ...photo, error: failures.get(photo.photoId) })));
        if (failures.size) {
          setError("送信できなかった写真があります。再試行するか、取り消して保存してください。");
          const data = await loadTaskPhotos(client, taskId);
          if (alive.current) {
            setSnapshot(data);
            if (data.completed) setError(photoSaveMessage("task_completed"));
          }
          return;
        }
      }

      if (!confirmed) {
        rpcSent = true;
        const result = await client.rpc("apply_task_photo_changes", {
          p_task_id: taskId,
          p_add_photo_ids: addIds,
          p_delete_photo_ids: deleteIds,
        });
        if (!alive.current) return;
        if (result.error) {
          // RPC自身のエラーならトランザクションは確定していない。それ以外は同じIDを保持する。
          const rejected = result.error.code === "P0001";
          if (rejected) rpcSent = false;
          setUncertain(!rejected);
          setError(photoSaveMessage(rejected ? result.error.message : ""));
          if (!rejected) return;
          const data = await loadTaskPhotos(client, taskId);
          if (alive.current) {
            setSnapshot(data);
            if (rejected) {
              const ids = new Set(data.photos.map((photo) => photo.photo_id));
              replaceDrafts(draftList.current.filter((photo) => !ids.has(photo.photoId)));
              setDeletions(deleteIds.filter((id) => ids.has(id)));
            }
          }
          return;
        }
        confirmed = true;
      }

      if (!alive.current) return;
      setUncertain(false);
      replaceDrafts([]);
      setDeletions([]);
      toast.success("写真を保存しました");
      setSnapshot(null);
      const data = await loadTaskPhotos(client, taskId);
      if (alive.current) setSnapshot(data);
    } catch {
      if (alive.current) {
        setUncertain(rpcSent && !confirmed);
        setError(
          confirmed
            ? "写真は保存されましたが、表示を更新できませんでした。再読み込みしてください。"
            : rpcSent
              ? photoSaveMessage("")
              : "写真を保存できませんでした。再試行してください。",
        );
      }
    } finally {
      working.current = false;
      if (alive.current) setSaving(false);
    }
  }

  return {
    snapshot,
    drafts,
    deletions,
    loading,
    converting,
    saving,
    uncertain,
    error,
    dirty: drafts.length > 0 || deletions.length > 0,
    add,
    retry,
    remove,
    toggleDeletion,
    reset,
    reload,
    save,
  };
}
