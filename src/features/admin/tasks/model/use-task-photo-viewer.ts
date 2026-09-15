"use client";

import { useCallback, useState } from "react";
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
  const [loadingPhotoId, setLoadingPhotoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const currentPhotoId = photoIds[currentIndex] ?? null;
  const currentSignedPhoto = currentPhotoId ? signedPhotos[currentPhotoId] : undefined;

  const loadSignedPhoto = useCallback(
    (photoId: string, force = false) => {
      const cached = signedPhotos[photoId];
      if (!force && cached && cached.expiresAt > Date.now()) {
        return;
      }

      setLoadingPhotoId(photoId);
      setError("");
      void client.storage
        .from("task-photos")
        .createSignedUrl(taskPhotoPath(taskId, photoId), SIGNED_URL_EXPIRES_IN_SECONDS)
        .then(({ data, error: signedUrlError }) => {
          if (signedUrlError || !data.signedUrl) {
            setError("写真を表示できませんでした。再読み込みしてください。");
            return;
          }
          setSignedPhotos((current) => ({
            ...current,
            [photoId]: {
              url: data.signedUrl,
              expiresAt: Date.now() + SIGNED_URL_EXPIRES_IN_SECONDS * 1000,
            },
          }));
        })
        .catch(() => {
          setError("写真を表示できませんでした。再読み込みしてください。");
        })
        .finally(() => {
          setLoadingPhotoId((current) => (current === photoId ? null : current));
        });
    },
    [client, signedPhotos, taskId],
  );

  const openViewer = () => {
    setCurrentIndex(0);
    setError("");
    const firstPhotoId = photoIds[0];
    if (firstPhotoId) {
      void loadSignedPhoto(firstPhotoId);
    }
  };

  const selectPhoto = (index: number) => {
    const photoId = photoIds[index];
    if (photoId) {
      setCurrentIndex(index);
      setError("");
      void loadSignedPhoto(photoId);
    }
  };

  const retryCurrentPhoto = () => {
    if (currentPhotoId) {
      void loadSignedPhoto(currentPhotoId, true);
    }
  };

  const reportCurrentPhotoError = () => {
    setError("写真を表示できませんでした。再読み込みしてください。");
  };

  return {
    photoIds,
    currentIndex,
    currentUrl: currentSignedPhoto?.url ?? null,
    signedPhotos,
    loadingCurrent: currentPhotoId === loadingPhotoId,
    error,
    openViewer,
    selectPhoto,
    retryCurrentPhoto,
    reportCurrentPhotoError,
  };
}
