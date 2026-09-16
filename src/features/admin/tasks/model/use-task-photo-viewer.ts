"use client";

import { useCallback, useRef, useState } from "react";
import { taskPhotoPath } from "@/features/tasks/model/task-photo";
import { createClient } from "@/lib/supabase/client";

type SignedPhoto = {
  url: string;
  expiresAt: number;
};

const SIGNED_URL_EXPIRES_IN_SECONDS = 60;

export function useTaskPhotoViewer(taskId: string, photoIds: string[]) {
  const [client] = useState(createClient);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [signedPhotos, setSignedPhotos] = useState<Record<string, SignedPhoto>>({});
  const [loadingPhotoIds, setLoadingPhotoIds] = useState<string[]>([]);
  const [errorPhotoIds, setErrorPhotoIds] = useState<string[]>([]);
  const loadingPhotoIdsRef = useRef(new Set<string>());

  const currentPhotoId = photoIds[currentIndex] ?? null;
  const currentSignedPhoto = currentPhotoId ? signedPhotos[currentPhotoId] : undefined;

  const loadSignedPhotos = useCallback(
    (targetPhotoIds: string[], force = false) => {
      const targets = targetPhotoIds.filter((photoId) => {
        if (loadingPhotoIdsRef.current.has(photoId)) {
          return false;
        }
        const cached = signedPhotos[photoId];
        return force || !cached || cached.expiresAt <= Date.now();
      });
      if (targets.length === 0) {
        return;
      }

      const targetSet = new Set(targets);
      targets.forEach((photoId) => loadingPhotoIdsRef.current.add(photoId));
      setLoadingPhotoIds((current) => [...new Set([...current, ...targets])]);
      setErrorPhotoIds((current) => current.filter((photoId) => !targetSet.has(photoId)));
      void client.storage
        .from("task-photos")
        .createSignedUrls(
          targets.map((photoId) => taskPhotoPath(taskId, photoId)),
          SIGNED_URL_EXPIRES_IN_SECONDS,
        )
        .then(({ data, error: signedUrlError }) => {
          const expiresAt = Date.now() + SIGNED_URL_EXPIRES_IN_SECONDS * 1000;
          const loaded: Record<string, SignedPhoto> = {};
          const failed: string[] = [];
          targets.forEach((photoId, index) => {
            const row = data?.[index];
            if (signedUrlError || !row || row.error || !row.signedUrl) {
              failed.push(photoId);
              return;
            }
            loaded[photoId] = { url: row.signedUrl, expiresAt };
          });
          setSignedPhotos((current) => ({ ...current, ...loaded }));
          if (failed.length > 0) {
            setErrorPhotoIds((current) => [...new Set([...current, ...failed])]);
          }
        })
        .catch(() => {
          setErrorPhotoIds((current) => [...new Set([...current, ...targets])]);
        })
        .finally(() => {
          targets.forEach((photoId) => loadingPhotoIdsRef.current.delete(photoId));
          setLoadingPhotoIds((current) => current.filter((photoId) => !targetSet.has(photoId)));
        });
    },
    [client, signedPhotos, taskId],
  );

  const openViewer = () => {
    setCurrentIndex(0);
    setErrorPhotoIds([]);
    loadSignedPhotos(photoIds);
  };

  const selectPhoto = (index: number) => {
    const photoId = photoIds[index];
    if (photoId) {
      setCurrentIndex(index);
      loadSignedPhotos([photoId]);
    }
  };

  const retryCurrentPhoto = () => {
    if (currentPhotoId) {
      loadSignedPhotos([currentPhotoId], true);
    }
  };

  const reportCurrentPhotoError = () => {
    if (currentPhotoId) {
      setErrorPhotoIds((current) => [...current, currentPhotoId]);
    }
  };

  return {
    photoIds,
    currentIndex,
    currentUrl: currentSignedPhoto?.url ?? null,
    signedPhotos,
    loadingCurrent: currentPhotoId !== null && loadingPhotoIds.includes(currentPhotoId),
    error:
      currentPhotoId !== null && errorPhotoIds.includes(currentPhotoId)
        ? "写真を表示できませんでした。再読み込みしてください。"
        : "",
    openViewer,
    selectPhoto,
    retryCurrentPhoto,
    reportCurrentPhotoError,
  };
}
