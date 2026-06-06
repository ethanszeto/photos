"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { GalleryGrid } from "@/features/gallery/components/GalleryGrid";
import { MediaViewer } from "@/features/gallery/components/MediaViewer";
import type { GalleryVirtualizerHandle } from "@/features/gallery/components/GalleryVirtualizer";
import { useGalleryPagination } from "@/features/gallery/hooks/useGalleryPagination";
import { useUpload } from "@/features/upload/components/UploadProvider";
import type { MediaItem } from "@/types";

type MediaGridPageProps = {
  title: string;
  initialItems: MediaItem[];
  initialCursor: string | null;
  apiPath: string;
  headerLeading?: ReactNode;
  refreshOnUpload?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function MediaGridPage({
  title,
  initialItems,
  initialCursor,
  apiPath,
  headerLeading,
  refreshOnUpload = false,
  emptyTitle = "No Photos Yet",
  emptyDescription = "Tap Upload to add your first photo.",
}: MediaGridPageProps) {
  const router = useRouter();
  const { registerOnUploaded } = useUpload();
  const gridRef = useRef<GalleryVirtualizerHandle>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const { items, hasMore, refreshing, loadMore, refreshGrid, handleRefresh } = useGalleryPagination({
    apiPath,
    initialItems,
    initialCursor,
    gridRef,
  });

  const idToIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < items.length; i++) {
      map.set(items[i].id, i);
    }
    return map;
  }, [items]);

  const handleSelect = useCallback(
    (item: MediaItem) => {
      const index = idToIndex.get(item.id);
      if (index != null) setViewerIndex(index);
    },
    [idToIndex],
  );

  useEffect(() => {
    if (!refreshOnUpload) return;
    return registerOnUploaded(() => {
      void refreshGrid("merge").catch((error) => {
        console.error("Failed to refresh grid after upload:", error);
      });
    });
  }, [refreshOnUpload, registerOnUploaded, refreshGrid]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-black text-white">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-black/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2">
          {headerLeading}
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            aria-label="Refresh"
            className="-ml-1 min-w-0 rounded-lg px-1 py-0.5 text-left transition-colors active:bg-white/10 disabled:opacity-60"
          >
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            <p className="text-xs text-white/50">
              {refreshing ? "Refreshing…" : `${items.length.toLocaleString()} loaded${hasMore ? "+" : ""}`}
            </p>
          </button>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          aria-label="Lock"
          className="shrink-0 rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 active:bg-white/15"
        >
          <Lock className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 pb-bottom-nav text-center">
            <p className="text-lg font-medium text-white/80">{emptyTitle}</p>
            <p className="mt-2 max-w-xs text-sm text-white/50">{emptyDescription}</p>
          </div>
        ) : (
          <div className="h-full" data-gallery-scroll-wrapper>
            <GalleryGrid
              items={items}
              gridRef={gridRef}
              onSelect={handleSelect}
              onLoadMore={loadMore}
              hasMore={hasMore}
            />
          </div>
        )}
      </div>

      {viewerIndex != null && (
        <MediaViewer
          items={items}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}
