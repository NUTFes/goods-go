"use client";

import { useCallback, useEffect, useState } from "react";
import { taskPhotoPath } from "@/features/tasks/model/task-photo";
import { createClient } from "@/lib/supabase/client";

type TaskPhotoReference = {
  photoId: string;
};

type SignedPhoto = {
  url: string;
  expiresAt: number;
};

const SIGNED_URL_EXPIRES_IN_SECONDS = 60;

export function useTaskPhotoViewer(taskId: string, open: boolean) {
  const [client] = useState(createClient);
  const [photos, setPhotos] = useState<TaskPhotoReference[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [signedPhotos, setSignedPhotos] = useState<Record<string, SignedPhoto>>({});
  const [loadingList, setLoadingList] = useState(false);
  const [loadingPhotoId, setLoadingPhotoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const currentPhoto = photos[currentIndex] ?? null;
  const currentSignedPhoto = currentPhoto ? signedPhotos[currentPhoto.photoId] : undefined;

  const loadSignedPhoto = useCallback(
    async (photoId: string, force = false) => {
      const cached = signedPhotos[photoId];
      if (!force && cached && cached.expiresAt > Date.now()) {
        return;
      }

      setLoadingPhotoId(photoId);
      setError("");
      const { data, error: signedUrlError } = await client.storage
        .from("task-photos")
        .createSignedUrl(taskPhotoPath(taskId, photoId), SIGNED_URL_EXPIRES_IN_SECONDS);

      if (signedUrlError || !data.signedUrl) {
        setError("写真を表示できませんでした。再読み込みしてください。");
      } else {
        setSignedPhotos((current) => ({
          ...current,
          [photoId]: {
            url: data.signedUrl,
            expiresAt: Date.now() + SIGNED_URL_EXPIRES_IN_SECONDS * 1000,
          },
        }));
      }
      setLoadingPhotoId((current) => (current === photoId ? null : current));
    },
    [client, signedPhotos, taskId],
  );

  const loadPhotoList = useCallback(async () => {
    setLoadingList(true);
    setError("");
    setPhotos([]);
    setSignedPhotos({});
    setCurrentIndex(0);

    const { data, error: photoListError } = await client
      .from("task_photos")
      .select("photo_id, sort_order")
      .eq("task_id", taskId)
      .is("deleted_at", null)
      .order("sort_order");

    if (photoListError) {
      setError("写真を取得できませんでした。再読み込みしてください。");
    } else {
      setPhotos(
        data.map((photo) => ({
          photoId: photo.photo_id,
        })),
      );
    }
    setLoadingList(false);
  }, [client, taskId]);

  useEffect(() => {
    if (open) {
      void loadPhotoList();
    }
  }, [loadPhotoList, open]);

  useEffect(() => {
    if (open && currentPhoto) {
      void loadSignedPhoto(currentPhoto.photoId);
    }
  }, [currentPhoto, loadSignedPhoto, open]);

  const selectPhoto = (index: number) => {
    if (index >= 0 && index < photos.length) {
      setCurrentIndex(index);
    }
  };

  const retryCurrentPhoto = () => {
    if (currentPhoto) {
      void loadSignedPhoto(currentPhoto.photoId, true);
    } else {
      void loadPhotoList();
    }
  };

  const reportCurrentPhotoError = () => {
    if (!currentPhoto) {
      return;
    }
    setError("写真を表示できませんでした。再読み込みしてください。");
  };

  return {
    photos,
    currentIndex,
    currentPhoto,
    currentUrl: currentSignedPhoto?.url ?? null,
    signedPhotos,
    loadingList,
    loadingCurrent: currentPhoto?.photoId === loadingPhotoId,
    error,
    selectPhoto,
    retryCurrentPhoto,
    reportCurrentPhotoError,
  };
}
