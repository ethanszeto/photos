"use client";

import { useRef } from "react";
import { GalleryVirtualizer, type GalleryVirtualizerHandle } from "@/features/gallery/components/GalleryVirtualizer";
import { LoadMoreSentinel } from "@/features/gallery/components/LoadMoreSentinel";
import { ZoomProvider } from "@/features/gallery/components/ZoomProvider";
import { useZoom } from "@/features/gallery/hooks/useZoom";
import type { MediaItem } from "@/types";

type GalleryGridProps = {
  items: MediaItem[];
  gridRef: React.RefObject<GalleryVirtualizerHandle | null>;
  onSelect: (item: MediaItem) => void;
  onLoadMore: () => void;
  hasMore: boolean;
};

/** Zoom-aware virtualized grid with a single scroll container for gestures and pagination. */
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
        <GalleryGridContent
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

type GalleryGridContentProps = {
  items: MediaItem[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  gridRef: React.RefObject<GalleryVirtualizerHandle | null>;
  onSelect: (item: MediaItem) => void;
  onLoadMore: () => void;
  hasMore: boolean;
};

function GalleryGridContent({
  items,
  scrollContainerRef,
  gridRef,
  onSelect,
  onLoadMore,
  hasMore,
}: GalleryGridContentProps) {
  const { layout, awarenessFocalItemIndex, clearAwarenessFocal, zoomInAt } = useZoom();

  return (
    <GalleryVirtualizer
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
          itemCount={items.length}
        />
      }
    />
  );
}
