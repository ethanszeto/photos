"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { UploadOptionsOverlay } from "@/features/upload/components/UploadOptionsOverlay";
import { filterFilesNewerThan, filterSelectableFiles } from "@/features/upload/lib/upload-files";
import { uploadFileToS3 } from "@/features/upload/lib/upload-client";
import { UPLOAD_ACCEPT } from "@/lib/media-types";
import { noStoreFetchInit } from "@/shared/lib/no-store";
import type { LatestMediaResponse, UploadResult } from "@/types";

type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

type BatchUploadState = {
  total: number;
  completed: number;
  failed: number;
  currentProgress: number;
  phase: "uploading" | "done";
};

type UploadMode = "select" | "since-latest";

type UploadContextValue = {
  openUpload: () => void;
  registerOnUploaded: (callback: (result: UploadResult) => void) => () => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

const BATCH_DISMISS_MS = 3000;
const SINGLE_DISMISS_MS = 2000;

function batchOverallPercent(batch: BatchUploadState): number {
  const { total, completed, failed, currentProgress, phase } = batch;
  if (total === 0) return 0;
  if (phase === "done") return 100;
  const finished = completed + failed;
  return Math.min(100, Math.round((finished * 100 + currentProgress) / total));
}

export function useUpload(): UploadContextValue {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUpload must be used within UploadProvider");
  }
  return context;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadModeRef = useRef<UploadMode>("select");
  const sinceTakenAtRef = useRef<string | null>(null);
  const onUploadedListenersRef = useRef(new Set<(result: UploadResult) => void>());

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuKey, setMenuKey] = useState(0);
  const [latestTakenAt, setLatestTakenAt] = useState<string | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [batch, setBatch] = useState<BatchUploadState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const notifyUploaded = useCallback((result: UploadResult) => {
    for (const listener of onUploadedListenersRef.current) {
      listener(result);
    }
  }, []);

  const registerOnUploaded = useCallback((callback: (result: UploadResult) => void) => {
    onUploadedListenersRef.current.add(callback);
    return () => {
      onUploadedListenersRef.current.delete(callback);
    };
  }, []);

  const refreshLatestTakenAt = useCallback(async (): Promise<string | null> => {
    setLoadingLatest(true);
    try {
      const response = await fetch("/api/gallery/latest", noStoreFetchInit);
      if (!response.ok) throw new Error("Failed to load latest photo date");
      const data = (await response.json()) as LatestMediaResponse;
      setLatestTakenAt(data.latestTakenAt);
      return data.latestTakenAt;
    } catch (error) {
      console.error("Latest takenAt fetch error:", error);
      return null;
    } finally {
      setLoadingLatest(false);
    }
  }, []);

  const openUpload = useCallback(() => {
    setMenuKey((key) => key + 1);
    setMenuOpen(true);
    void refreshLatestTakenAt();
  }, [refreshLatestTakenAt]);

  const openFilePicker = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.click());
  }, []);

  const uploadSingleFile = useCallback(
    async (file: File) => {
      const id = crypto.randomUUID();
      setUploads([{ id, name: file.name, progress: 0, status: "uploading" }]);

      try {
        const result = await uploadFileToS3(file, (progress) => {
          setUploads((current) => current.map((item) => (item.id === id ? { ...item, progress } : item)));
        });

        setUploads((current) => current.map((item) => (item.id === id ? { ...item, progress: 100, status: "done" } : item)));
        notifyUploaded(result);

        setTimeout(() => setUploads([]), SINGLE_DISMISS_MS);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        setUploads((current) => current.map((item) => (item.id === id ? { ...item, status: "error", error: message } : item)));
      }
    },
    [notifyUploaded],
  );

  const uploadBatch = useCallback(
    async (files: File[]) => {
      const total = files.length;
      let completed = 0;
      let failed = 0;
      let lastResult: UploadResult | null = null;

      setBatch({ total, completed: 0, failed: 0, currentProgress: 0, phase: "uploading" });

      for (const file of files) {
        try {
          const result = await uploadFileToS3(file, (progress) => {
            setBatch({ total, completed, failed, currentProgress: progress, phase: "uploading" });
          });
          completed++;
          lastResult = result;
          setBatch({ total, completed, failed, currentProgress: 100, phase: "uploading" });
        } catch {
          failed++;
          setBatch({ total, completed, failed, currentProgress: 0, phase: "uploading" });
        }
      }

      setBatch({ total, completed, failed, currentProgress: 100, phase: "done" });

      if (completed > 0 && lastResult) {
        notifyUploaded(lastResult);
      }

      setTimeout(() => setBatch(null), BATCH_DISMISS_MS);
    },
    [notifyUploaded],
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      if (files.length === 1) {
        await uploadSingleFile(files[0]);
        return;
      }
      await uploadBatch(files);
    },
    [uploadSingleFile, uploadBatch],
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

  const toastBottomClass =
    "fixed left-4 right-4 z-40 mx-auto max-w-md bottom-[calc(var(--bottom-nav-offset)+0.75rem)]";

  const batchLabel = batch
    ? batch.phase === "done"
      ? batch.failed === 0
        ? `Uploaded ${batch.completed} photo${batch.completed === 1 ? "" : "s"}`
        : `Uploaded ${batch.completed} of ${batch.total}${batch.failed > 0 ? ` · ${batch.failed} failed` : ""}`
      : `Uploading ${batch.completed + batch.failed + 1} of ${batch.total}`
    : "";

  return (
    <UploadContext.Provider value={{ openUpload, registerOnUploaded }}>
      {children}

      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
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
        <div
          className={`${toastBottomClass} rounded-2xl border border-white/10 bg-zinc-900/95 px-4 py-3 text-center text-sm text-white/80 shadow-xl backdrop-blur-md`}
        >
          {statusMessage}
        </div>
      )}

      {batch && (
        <div className={`${toastBottomClass} rounded-2xl border border-white/10 bg-zinc-900/95 px-4 py-3 shadow-xl backdrop-blur-md`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-white/90">{batch.phase === "done" ? "Upload complete" : "Uploading photos"}</p>
            <span className="text-xs tabular-nums text-white/50">{batchLabel}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/80 transition-all duration-200"
              style={{ width: `${batchOverallPercent(batch)}%` }}
            />
          </div>
        </div>
      )}

      {!batch && uploads.length > 0 && (
        <div className={`${toastBottomClass} space-y-2`}>
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
    </UploadContext.Provider>
  );
}
