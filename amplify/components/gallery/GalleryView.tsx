"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { UploadFAB } from "@/components/gallery/UploadFAB";
import { Lock } from "lucide-react";
import type { GalleryPhoto } from "@/types";

type GalleryViewProps = {
  initialPhotos: GalleryPhoto[];
};

export function GalleryView({ initialPhotos }: GalleryViewProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initialPhotos);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGallery = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/gallery/list");
      if (!response.ok) {
        throw new Error("Failed to load photos");
      }
      const data = (await response.json()) as { photos: GalleryPhoto[] };
      setPhotos(data.photos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gallery");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleUploaded = (photo: GalleryPhoto) => {
    setPhotos((current) => {
      if (current.some((p) => p.photoId === photo.photoId)) {
        return current;
      }
      return [photo, ...current];
    });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-black/80 px-4 py-3 backdrop-blur-xl">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Photos</h1>
          <p className="text-xs text-white/50">{refreshing ? "Refreshing…" : `${photos.length} items`}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          aria-label="Lock"
          className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 active:bg-white/15"
        >
          <Lock className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
          <p className="text-center text-sm text-red-400">{error}</p>
          <button type="button" onClick={() => void loadGallery()} className="rounded-full bg-white/10 px-4 py-2 text-sm">
            Retry
          </button>
        </div>
      )}

      {!error && <GalleryGrid photos={photos} />}

      <UploadFAB onUploaded={handleUploaded} />
    </div>
  );
}
