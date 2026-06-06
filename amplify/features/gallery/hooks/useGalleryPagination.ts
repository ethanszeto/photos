"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GalleryVirtualizerHandle } from "@/features/gallery/lib/types";
import { noStoreFetchInit } from "@/shared/lib/no-store";
import type { MediaItem, MediaListResponse } from "@/types";

type UseGalleryPaginationOptions = {
  apiPath: string;
  initialItems: MediaItem[];
  initialCursor: string | null;
  gridRef: React.RefObject<GalleryVirtualizerHandle | null>;
};

/** Single source of truth for gallery cursor pagination and refresh. */
export function useGalleryPagination({
  apiPath,
  initialItems,
  initialCursor,
  gridRef,
}: UseGalleryPaginationOptions) {
  const router = useRouter();
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const loadingMoreRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const refreshGrid = useCallback(
    async (mode: "replace" | "merge", onReplace?: () => void) => {
      const response = await fetch(`${apiPath}?limit=100`, noStoreFetchInit);
      if (!response.ok) throw new Error("Failed to load media");
      const data = (await response.json()) as MediaListResponse;

      if (mode === "replace") {
        setItems(data.items);
        setCursor(data.nextCursor);
        onReplace?.();
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
    [apiPath, gridRef, router],
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

  return {
    items,
    hasMore: cursor != null,
    refreshing,
    loadMore,
    refreshGrid,
    handleRefresh,
  };
}
