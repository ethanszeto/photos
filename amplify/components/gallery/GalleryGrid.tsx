"use client";

import { useEffect, useRef } from "react";
import { GridImageVisibilityProvider } from "@/components/gallery/GridImageVisibility";
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
};

function LoadMoreSentinel({
  scrollRootRef,
  onLoadMore,
  hasMore,
}: {
  scrollRootRef: React.RefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
  hasMore: boolean;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    const root = scrollRootRef.current;
    if (!node || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { root, rootMargin: "800px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, scrollRootRef]);

  if (!hasMore) return null;

  return <div ref={sentinelRef} className="h-20" aria-hidden />;
}

function GalleryGridInner({
  items,
  scrollContainerRef,
  gridRef,
  onSelect,
  onLoadMore,
  hasMore,
}: GalleryGridInnerProps) {
  const { layout, awarenessFocalItemIndex, clearAwarenessFocal, zoomInAt } = useZoom();

  return (
    <GridImageVisibilityProvider scrollRef={scrollContainerRef} rootMargin={layout.imageLoadMargin}>
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
        <LoadMoreSentinel scrollRootRef={scrollContainerRef} onLoadMore={onLoadMore} hasMore={hasMore} />
      }
      />
    </GridImageVisibilityProvider>
  );
}

type GalleryGridProps = {
  items: MediaItem[];
  gridRef: React.RefObject<VirtualizedGridHandle | null>;
  onSelect: (item: MediaItem) => void;
  onLoadMore: () => void;
  hasMore: boolean;
};

/** Zoom-aware virtualized grid — single scroll container shared with gesture handlers. */
export function GalleryGrid({ items, gridRef, onSelect, onLoadMore, hasMore }: GalleryGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  return (
    <ZoomProvider containerRef={scrollContainerRef} itemCount={items.length}>
      <div
        ref={scrollContainerRef}
        data-gallery-scroll
        className="h-full min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-bottom-nav [-webkit-overflow-scrolling:touch]"
        style={{ touchAction: "pan-y" }}
      >
        <GalleryGridInner
          items={items}
          scrollContainerRef={scrollContainerRef}
          gridRef={gridRef}
          onSelect={onSelect}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
        />
      </div>
    </ZoomProvider>
  );
}
