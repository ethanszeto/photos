"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UploadOptionsOverlay } from "@/components/gallery/UploadOptionsOverlay";
import { filterFilesNewerThan, filterSelectableFiles } from "@/lib/upload-files";
import { uploadFileToS3 } from "@/lib/upload-client";
import type { LatestMediaResponse, UploadResult } from "@/types";

type UploadFABProps = {
  onUploaded: (result: UploadResult) => void;
  /** Optimistic hint from loaded gallery items (newest first). */
  latestTakenAt?: string | null;
};

type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

type UploadMode = "select" | "since-latest";

export function UploadFAB({ onUploaded, latestTakenAt: latestTakenAtHint }: UploadFABProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadModeRef = useRef<UploadMode>("select");
  const sinceTakenAtRef = useRef<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuKey, setMenuKey] = useState(0);
  const [latestTakenAt, setLatestTakenAt] = useState<string | null>(latestTakenAtHint ?? null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const busy = uploads.some((u) => u.status === "uploading");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setLatestTakenAt(latestTakenAtHint ?? null);
    });
    return () => cancelAnimationFrame(frame);
  }, [latestTakenAtHint]);

  const refreshLatestTakenAt = useCallback(async (): Promise<string | null> => {
    setLoadingLatest(true);
    try {
      const response = await fetch("/api/media/latest");
      if (!response.ok) throw new Error("Failed to load latest photo date");
      const data = (await response.json()) as LatestMediaResponse;
      setLatestTakenAt(data.latestTakenAt);
      return data.latestTakenAt;
    } catch (error) {
      console.error("Latest takenAt fetch error:", error);
      return latestTakenAtHint ?? null;
    } finally {
      setLoadingLatest(false);
    }
  }, [latestTakenAtHint]);

  const openFilePicker = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.click());
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      for (const file of files) {
        const id = crypto.randomUUID();
        setUploads((current) => [...current, { id, name: file.name, progress: 0, status: "uploading" }]);

        try {
          const result = await uploadFileToS3(file, (progress) => {
            setUploads((current) => current.map((item) => (item.id === id ? { ...item, progress } : item)));
          });

          setUploads((current) => current.map((item) => (item.id === id ? { ...item, progress: 100, status: "done" } : item)));
          onUploaded(result);

          setTimeout(() => {
            setUploads((current) => current.filter((item) => item.id !== id));
          }, 2000);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed";
          setUploads((current) => current.map((item) => (item.id === id ? { ...item, status: "error", error: message } : item)));
        }
      }
    },
    [onUploaded],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;

      let fileArray = filterSelectableFiles(files);

      if (uploadModeRef.current === "since-latest") {
        const since = sinceTakenAtRef.current;
        fileArray = filterFilesNewerThan(fileArray, since);
        if (fileArray.length === 0) {
          setStatusMessage(
            since ? "No selected photos are newer than your latest backed-up photo." : "No supported photos were selected.",
          );
          setTimeout(() => setStatusMessage(null), 4000);
          if (inputRef.current) inputRef.current.value = "";
          return;
        }
      }

      await uploadFiles(fileArray);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [uploadFiles],
  );

  const handleFabClick = () => {
    setMenuKey((key) => key + 1);
    setMenuOpen(true);
    void refreshLatestTakenAt();
  };

  const handleSelectPhotos = () => {
    uploadModeRef.current = "select";
    setMenuOpen(false);
    openFilePicker();
  };

  const handleUploadSinceLatest = async () => {
    uploadModeRef.current = "since-latest";
    const since = await refreshLatestTakenAt();
    sinceTakenAtRef.current = since;
    setMenuOpen(false);
    openFilePicker();
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {menuOpen && (
        <UploadOptionsOverlay
          key={menuKey}
          latestTakenAt={latestTakenAt}
          loadingLatest={loadingLatest}
          onSelectPhotos={handleSelectPhotos}
          onUploadSinceLatest={() => void handleUploadSinceLatest()}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {statusMessage && (
        <div className="fixed left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-white/10 bg-zinc-900/95 px-4 py-3 text-center text-sm text-white/80 shadow-xl backdrop-blur-md bottom-[calc(6rem+env(safe-area-inset-bottom,0px))]">
          {statusMessage}
        </div>
      )}

      {uploads.length > 0 && (
        <div className="fixed left-4 right-4 z-40 mx-auto max-w-md space-y-2 bottom-[calc(6rem+env(safe-area-inset-bottom,0px))]">
          {uploads.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-zinc-900/95 px-4 py-3 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm text-white/90">{item.name}</p>
                <span className="text-xs text-white/50">
                  {item.status === "error" ? "Failed" : item.status === "done" ? "Done" : `${item.progress}%`}
                </span>
              </div>
              {item.status === "uploading" && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-white/80 transition-all duration-200"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              {item.error && <p className="mt-1 text-xs text-red-400">{item.error}</p>}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={handleFabClick}
        className="fixed right-[max(1.5rem,env(safe-area-inset-right,0px))] bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] z-50 flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-[28px] font-light text-white shadow-lg ring-1 ring-white/10 backdrop-blur-xl transition-transform active:scale-95 disabled:opacity-50"
        aria-label="Upload photos"
      >
        +
      </button>
    </>
  );
}
