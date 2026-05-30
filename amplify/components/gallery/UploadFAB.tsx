"use client";

import { useRef, useState } from "react";
import { uploadFileToS3 } from "@/lib/upload-client";
import type { UploadResult } from "@/types";

type UploadFABProps = {
  onUploaded: (result: UploadResult) => void;
};

type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

export function UploadFAB({ onUploaded }: UploadFABProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const busy = uploads.some((u) => u.status === "uploading");

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|heic|heif)$/i.test(f.name));

    for (const file of fileArray) {
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

    if (inputRef.current) {
      inputRef.current.value = "";
    }
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

      {uploads.length > 0 && (
        <div className="fixed bottom-24 left-4 right-4 z-40 mx-auto max-w-md space-y-2">
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
                    className="h-full rounded-full bg-blue-500 transition-all duration-200"
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
        onClick={() => inputRef.current?.click()}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-2xl text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-95 disabled:opacity-60"
        aria-label="Upload photos"
      >
        +
      </button>
    </>
  );
}
