"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { MediaViewer } from "@/components/gallery/MediaViewer";
import { UploadFAB } from "@/components/gallery/UploadFAB";
import type { VirtualizedGridHandle } from "@/components/gallery/VirtualizedGrid";
import { noStoreFetchInit } from "@/lib/no-store";
import { trimLoadedItems } from "@/lib/media-window";
import type { MediaItem, MediaListResponse } from "@/types";

type GalleryPageProps = {
  initialItems: MediaItem[];
  initialCursor: string | null;
};

/**
 * Apple Photos-inspired gallery shell.
 * - Cursor-paginated infinite scroll
 * - Virtualized grid with zoom-controlled column density
 * - Fullscreen detail viewer
 */
export function GalleryPage({ initialItems, initialCursor }: GalleryPageProps) {
  const router = useRouter();
  const gridRef = useRef<VirtualizedGridHandle>(null);
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const idToIndexRef = useRef(new Map<string, number>());

  const applyLoadedItems = useCallback((merged: MediaItem[]) => {
    const anchor = gridRef.current?.getFirstVisibleItemIndex() ?? 0;
    const { items: trimmed, removedFromStart } = trimLoadedItems(merged, anchor);

    if (removedFromStart > 0) {
      requestAnimationFrame(() => {
        gridRef.current?.preserveScrollAfterTrim(removedFromStart);
      });
    }

    return trimmed;
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/gallery?cursor=${encodeURIComponent(cursor)}`, noStoreFetchInit);
      if (!response.ok) throw new Error("Failed to load more media");
      const data = (await response.json()) as { items: MediaItem[]; nextCursor: string | null };
      setItems((current) => applyLoadedItems([...current, ...data.items]));
      setCursor(data.nextCursor);
    } catch (error) {
      console.error("Infinite scroll error:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, applyLoadedItems]);

  const handleSelect = useCallback((item: MediaItem) => {
    const index = idToIndexRef.current.get(item.id);
    if (index != null) setViewerIndex(index);
  }, []);

  useEffect(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < items.length; i++) {
      map.set(items[i].id, i);
    }
    idToIndexRef.current = map;
  }, [items]);

  const refreshGallery = useCallback(
    async (mode: "replace" | "merge") => {
      const response = await fetch("/api/gallery?limit=100", noStoreFetchInit);
      if (!response.ok) throw new Error("Failed to load media");
      const data = (await response.json()) as MediaListResponse;

      if (mode === "replace") {
        setItems(applyLoadedItems(data.items));
        setCursor(data.nextCursor);
        setViewerIndex(null);
        requestAnimationFrame(() => {
          gridRef.current?.scrollToItemIndex(0, { align: "start", behavior: "auto" });
        });
      } else {
        setItems((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          for (const item of data.items) {
            byId.set(item.id, item);
          }
          const merged = Array.from(byId.values()).sort(
            (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
          );
          return applyLoadedItems(merged);
        });
      }

      router.refresh();
    },
    [applyLoadedItems, router],
  );

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshGallery("replace");
    } catch (error) {
      console.error("Gallery refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshGallery, refreshing]);

  const handleUploaded = useCallback(async () => {
    try {
      await refreshGallery("merge");
    } catch (error) {
      console.error("Failed to refresh gallery after upload:", error);
    }
  }, [refreshGallery]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-black text-white">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-black/80 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          aria-label="Refresh gallery"
          className="-ml-1 rounded-lg px-1 py-0.5 text-left transition-colors active:bg-white/10 disabled:opacity-60"
        >
          <h1 className="text-lg font-semibold tracking-tight">Photos</h1>
          <p className="text-xs text-white/50">
            {refreshing
              ? "Refreshing…"
              : `${items.length.toLocaleString()} loaded${cursor != null ? "+" : ""}`}
          </p>
        </button>
        <button
          type="button"
          onClick={() => void handleLogout()}
          aria-label="Lock"
          className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 active:bg-white/15"
        >
          <Lock className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 pb-28 text-center">
            <p className="text-lg font-medium text-white/80">No Photos Yet</p>
            <p className="mt-2 max-w-xs text-sm text-white/50">Tap the upload button to add your first photo.</p>
          </div>
        ) : (
          <div className="h-full" data-gallery-scroll-wrapper>
            <GalleryGrid
              items={items}
              gridRef={gridRef}
              onSelect={handleSelect}
              onLoadMore={loadMore}
              hasMore={cursor != null}
              loadingMore={loadingMore}
            />
          </div>
        )}
      </div>

      <UploadFAB onUploaded={handleUploaded} latestTakenAt={items[0]?.takenAt ?? null} />

      {viewerIndex != null && <MediaViewer items={items} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />}
    </div>
  );
}
