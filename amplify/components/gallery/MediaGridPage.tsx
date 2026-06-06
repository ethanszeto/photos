"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { MediaViewer } from "@/components/gallery/MediaViewer";
import type { VirtualizedGridHandle } from "@/components/gallery/VirtualizedGrid";
import { useUpload } from "@/components/upload/UploadProvider";
import { noStoreFetchInit } from "@/lib/no-store";
import type { MediaItem, MediaListResponse } from "@/types";

type MediaGridPageProps = {
  title: string;
  initialItems: MediaItem[];
  initialCursor: string | null;
  /** Base API path for pagination and refresh, e.g. `/api/gallery` or `/api/albums/2026`. */
  apiPath: string;
  /** Optional leading header control (e.g. back button on album detail). */
  headerLeading?: ReactNode;
  /** When true, register upload callbacks to refresh this grid. */
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
  const gridRef = useRef<VirtualizedGridHandle>(null);
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const loadingMoreRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const idToIndexRef = useRef(new Map<string, number>());

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      const response = await fetch(`${apiPath}?cursor=${encodeURIComponent(cursor)}`, noStoreFetchInit);
      if (!response.ok) throw new Error("Failed to load more media");
      const data = (await response.json()) as MediaListResponse;
      setItems((current) => [...current, ...data.items]);
      setCursor(data.nextCursor);
    } catch (error) {
      console.error("Infinite scroll error:", error);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [apiPath, cursor]);

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

  const refreshGrid = useCallback(
    async (mode: "replace" | "merge") => {
      const response = await fetch(`${apiPath}?limit=100`, noStoreFetchInit);
      if (!response.ok) throw new Error("Failed to load media");
      const data = (await response.json()) as MediaListResponse;

      if (mode === "replace") {
        setItems(data.items);
        setCursor(data.nextCursor);
        setViewerIndex(null);
        requestAnimationFrame(() => {
          gridRef.current?.scrollToItemIndex(0, { align: "start", behavior: "auto" });
        });
      } else {
        setItems((current) => {
          const currentIds = new Set(current.map((item) => item.id));
          const updates = new Map(data.items.map((item) => [item.id, item]));
          const newFromApi = data.items.filter((item) => !currentIds.has(item.id));
          const existing = current.map((item) => updates.get(item.id) ?? item);
          return [...newFromApi, ...existing];
        });
      }

      router.refresh();
    },
    [apiPath, router],
  );

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshGrid("replace");
    } catch (error) {
      console.error("Grid refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshGrid, refreshing]);

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
              {refreshing
                ? "Refreshing…"
                : `${items.length.toLocaleString()} loaded${cursor != null ? "+" : ""}`}
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
              hasMore={cursor != null}
            />
          </div>
        )}
      </div>

      {viewerIndex != null && <MediaViewer items={items} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />}
    </div>
  );
}
