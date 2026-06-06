"use client";

import { useEffect, useRef } from "react";
import { VirtualizedGrid, type VirtualizedGridHandle } from "@/components/gallery/VirtualizedGrid";
import { useZoom, ZoomProvider } from "@/components/gallery/ZoomController";
import type { MediaItem } from "@/types";

type GalleryGridInnerProps = {
  items: MediaItem[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  gridRef: React.RefObject<VirtualizedGridHandle | null>;
  onSelect: (item: MediaItem) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
};

function LoadMoreSentinel({
  scrollRootRef,
  onLoadMore,
  hasMore,
  loadingMore,
}: {
  scrollRootRef: React.RefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    const root = scrollRootRef.current;
    if (!node || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) {
          onLoadMore();
        }
      },
      { root, rootMargin: "800px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, scrollRootRef]);

  if (!hasMore) return null;

  return (
    <div ref={sentinelRef} className="flex h-20 items-center justify-center">
      {loadingMore && <span className="text-xs text-white/40">Loading…</span>}
    </div>
  );
}

function GalleryGridInner({
  items,
  scrollContainerRef,
  gridRef,
  onSelect,
  onLoadMore,
  hasMore,
  loadingMore,
}: GalleryGridInnerProps) {
  const { layout, awarenessFocalItemIndex, clearAwarenessFocal, zoomInAt } = useZoom();

  return (
    <VirtualizedGrid
      ref={gridRef}
      parentRef={scrollContainerRef}
      items={items}
      layout={layout}
      awarenessFocalItemIndex={awarenessFocalItemIndex}
      onAwarenessFocalApplied={clearAwarenessFocal}
      onSelect={onSelect}
      onLiteZoom={zoomInAt}
      loadMoreSentinel={
        <LoadMoreSentinel
          scrollRootRef={scrollContainerRef}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
          loadingMore={loadingMore}
        />
      }
    />
  );
}

type GalleryGridProps = {
  items: MediaItem[];
  gridRef: React.RefObject<VirtualizedGridHandle | null>;
  onSelect: (item: MediaItem) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
};

/** Zoom-aware virtualized grid — single scroll container shared with gesture handlers. */
export function GalleryGrid({ items, gridRef, onSelect, onLoadMore, hasMore, loadingMore }: GalleryGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  return (
    <ZoomProvider containerRef={scrollContainerRef} itemCount={items.length}>
      <div
        ref={scrollContainerRef}
        data-gallery-scroll
        className="h-full min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-28 [-webkit-overflow-scrolling:touch]"
        style={{ touchAction: "pan-y" }}
      >
        <GalleryGridInner
          items={items}
          scrollContainerRef={scrollContainerRef}
          gridRef={gridRef}
          onSelect={onSelect}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
          loadingMore={loadingMore}
        />
      </div>
    </ZoomProvider>
  );
}
