"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { MediaViewer } from "@/components/gallery/MediaViewer";
import { UploadFAB } from "@/components/gallery/UploadFAB";
import { buildYearIndex, extractYears, getActiveYear, YearRail } from "@/components/gallery/YearRail";
import type { VirtualizedGridHandle } from "@/components/gallery/VirtualizedGrid";
import type { MediaItem, MediaListResponse } from "@/types";

type GalleryPageProps = {
  initialItems: MediaItem[];
  initialCursor: string | null;
};

/**
 * Apple Photos-inspired gallery shell.
 * - Cursor-paginated infinite scroll
 * - Virtualized grid with zoom-controlled column density
 * - Year navigation rail
 * - Fullscreen detail viewer
 */
export function GalleryPage({ initialItems, initialCursor }: GalleryPageProps) {
  const router = useRouter();
  const gridRef = useRef<VirtualizedGridHandle>(null);
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const itemsRef = useRef(items);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeYear, setActiveYear] = useState<number | null>(() =>
    initialItems[0] ? new Date(initialItems[0].takenAt).getFullYear() : null,
  );
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const yearIndex = useMemo(() => buildYearIndex(items), [items]);
  const years = useMemo(() => extractYears(items), [items]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/media?cursor=${encodeURIComponent(cursor)}`);
      if (!response.ok) throw new Error("Failed to load more media");
      const data = (await response.json()) as { items: MediaItem[]; nextCursor: string | null };
      setItems((current) => [...current, ...data.items]);
      setCursor(data.nextCursor);
    } catch (error) {
      console.error("Infinite scroll error:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const handleSelect = useCallback(
    (item: MediaItem) => {
      const index = items.findIndex((entry) => entry.id === item.id);
      if (index >= 0) setViewerIndex(index);
    },
    [items],
  );

  const handleYearSelect = useCallback(
    (year: number) => {
      const itemIndex = yearIndex.get(year);
      if (itemIndex == null) return;
      gridRef.current?.scrollToItemIndex(itemIndex);
      setActiveYear(year);
    },
    [yearIndex],
  );

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Track active year from scroll position without forcing re-renders every frame.
  useEffect(() => {
    if (items.length === 0) return;

    const scrollEl = document.querySelector<HTMLDivElement>("[data-gallery-scroll]");
    if (!scrollEl) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const firstIndex = gridRef.current?.getFirstVisibleItemIndex() ?? 0;
        const year = getActiveYear(itemsRef.current, firstIndex);
        setActiveYear((current) => (current === year ? current : year));
      });
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [items.length]);

  const handleUploaded = useCallback(async () => {
    try {
      const response = await fetch("/api/media?limit=100");
      if (!response.ok) return;
      const data = (await response.json()) as MediaListResponse;
      setItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        for (const item of data.items) {
          byId.set(item.id, item);
        }
        return Array.from(byId.values()).sort(
          (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
        );
      });
    } catch (error) {
      console.error("Failed to refresh gallery after upload:", error);
    }
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200/80 bg-white/90 px-4 py-3 backdrop-blur-md">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Photos</h1>
          <p className="text-xs text-neutral-500">{items.length.toLocaleString()} items</p>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="rounded-full px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100"
        >
          Lock
        </button>
      </header>

      <div className="relative min-h-0 flex-1 pl-8 sm:pl-10">
        <YearRail years={years} activeYear={activeYear} onYearSelect={handleYearSelect} />

        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-lg font-medium text-neutral-700">No Photos Yet</p>
            <p className="mt-2 max-w-xs text-sm text-neutral-500">Your archive will appear here once media is processed.</p>
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

      <UploadFAB onUploaded={handleUploaded} />

      {viewerIndex != null && <MediaViewer items={items} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />}
    </div>
  );
}
