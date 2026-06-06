"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useReducer,
  useRef,
  type RefObject,
} from "react";
import { setThumbnailLoadBudget } from "@/features/gallery/lib/thumbnail-load-gate";
import { MediaCell, MediaCellPlaceholder } from "@/features/gallery/components/MediaCell";
import {
  computeVisibleImageRange,
  getCenterItemIndex,
  isIndexInRange,
  rowVisibleOverlap,
  type GridLayoutMetrics,
} from "@/features/gallery/lib/grid-layout";
import type { GalleryVirtualizerHandle } from "@/features/gallery/lib/types";
import type { MediaItem } from "@/types";

export type { GalleryVirtualizerHandle };

const LOAD_MORE_SENTINEL_HEIGHT = 80;

type GalleryVirtualizerProps = {
  items: MediaItem[];
  layout: GridLayoutMetrics;
  awarenessFocalItemIndex: number | null;
  onAwarenessFocalApplied: () => void;
  onSelect: (item: MediaItem) => void;
  onLiteZoom: (itemIndex: number) => void;
  parentRef: RefObject<HTMLDivElement | null>;
  isScrollIdle: boolean;
  loadMoreSentinel?: React.ReactNode;
};

type LayoutSnapshot = {
  columns: number;
  rowHeight: number;
  gapPx: number;
};

/**
 * Row virtualizer — only mounted rows render DOM nodes and <img> elements.
 * Unmounting a row releases its cells and decoded thumbnails.
 */
export const GalleryVirtualizer = forwardRef<GalleryVirtualizerHandle, GalleryVirtualizerProps>(
  function GalleryVirtualizer(
    {
      items,
      layout,
      awarenessFocalItemIndex,
      onAwarenessFocalApplied,
      onSelect,
      onLiteZoom,
      parentRef,
      isScrollIdle,
      loadMoreSentinel,
    },
    ref,
  ) {
    const layoutSnapshot = useRef<LayoutSnapshot | null>(null);

    const { columns, gapPx, cellWidth, rowHeight, rowCount, overscan, gridTemplateColumns, thumbnailTier, liteCell } =
      layout;

    const getScrollElement = useCallback(() => parentRef.current, [parentRef]);

    const getItemKey = useCallback(
      (rowIndex: number) => {
        const first = items[rowIndex * columns];
        return first?.id ?? `row-${rowIndex}`;
      },
      [items, columns],
    );

    const scrollRafRef = useRef<number | null>(null);
    const [, bumpScrollFrame] = useReducer((tick: number) => tick + 1, 0);

    const virtualizer = useVirtualizer({
      count: rowCount,
      getScrollElement,
      estimateSize: () => rowHeight,
      overscan,
      getItemKey,
      onChange: () => {
        if (scrollRafRef.current != null) return;
        scrollRafRef.current = requestAnimationFrame(() => {
          scrollRafRef.current = null;
          bumpScrollFrame();
        });
      },
    });

    useEffect(() => {
      return () => {
        if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
      };
    }, []);

    useEffect(() => {
      setThumbnailLoadBudget(!isScrollIdle);
    }, [isScrollIdle]);

    useEffect(() => {
      if (rowHeight <= 0) return;
      for (const virtualRow of virtualizer.getVirtualItems()) {
        virtualizer.resizeItem(virtualRow.index, rowHeight);
      }
    }, [rowHeight, virtualizer]);

    const virtualRows = virtualizer.getVirtualItems();
    const scrollEl = parentRef.current;
    const scrollOffset = virtualizer.scrollOffset ?? scrollEl?.scrollTop ?? 0;
    const visibleRange = computeVisibleImageRange(
      scrollOffset,
      scrollEl?.clientHeight ?? 0,
      rowHeight,
      columns,
      items.length,
    );

    const getCenterIndex = useCallback(() => {
      const el = parentRef.current;
      if (!el) return 0;
      return getCenterItemIndex(el.scrollTop, el.clientHeight, rowHeight, columns, items.length);
    }, [parentRef, rowHeight, columns, items.length]);

    useLayoutEffect(() => {
      const el = parentRef.current;
      if (!el || rowCount === 0) return;

      const prev = layoutSnapshot.current;
      const next: LayoutSnapshot = { columns, rowHeight, gapPx };

      if (prev && (prev.columns !== columns || prev.rowHeight !== rowHeight || prev.gapPx !== gapPx)) {
        const focalIndex =
          awarenessFocalItemIndex ??
          getCenterItemIndex(el.scrollTop, el.clientHeight, prev.rowHeight, prev.columns, items.length);
        const rowIndex = Math.floor(focalIndex / columns);
        virtualizer.scrollToIndex(rowIndex, { align: "center", behavior: "auto" });
        if (awarenessFocalItemIndex != null) {
          onAwarenessFocalApplied();
        }
      }

      layoutSnapshot.current = next;
    }, [
      columns,
      rowHeight,
      gapPx,
      rowCount,
      items.length,
      virtualizer,
      parentRef,
      awarenessFocalItemIndex,
      onAwarenessFocalApplied,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        scrollToItemIndex(index, options) {
          const rowIndex = Math.floor(index / columns);
          virtualizer.scrollToIndex(rowIndex, {
            align: options?.align ?? "start",
            behavior: options?.behavior ?? "smooth",
          });
        },
        getFirstVisibleItemIndex() {
          const firstRow = virtualizer.getVirtualItems()[0];
          if (!firstRow) return 0;
          return firstRow.index * columns;
        },
        getCenterItemIndex: getCenterIndex,
        getVirtualizer() {
          return virtualizer;
        },
      }),
      [virtualizer, columns, getCenterIndex],
    );

    const totalSize = virtualizer.getTotalSize();
    const scrollHeight = totalSize + (loadMoreSentinel ? LOAD_MORE_SENTINEL_HEIGHT : 0);
    const rowGapStyle = gapPx > 0 ? `${gapPx}px` : "0";

    return (
      <div style={{ height: `${scrollHeight}px`, width: "100%", position: "relative" }}>
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const visibleOverlap = rowVisibleOverlap(virtualRow.index, columns, items.length, visibleRange);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              className="absolute left-0 top-0 w-full"
              style={{
                height: rowHeight,
                transform: `translateY(${virtualRow.start}px)`,
                display: "grid",
                gridTemplateColumns,
                gap: rowGapStyle,
                contain: "layout style paint",
              }}
            >
              {Array.from({ length: columns }, (_, col) => {
                const item = items[startIndex + col];
                if (!item) {
                  return <MediaCellPlaceholder key={`empty-${virtualRow.index}-${col}`} cellSize={cellWidth} />;
                }

                const itemIndex = startIndex + col;
                const isVisibleImage = visibleOverlap != null && isIndexInRange(itemIndex, visibleOverlap);

                return (
                  <MediaCell
                    key={item.id}
                    item={item}
                    itemIndex={itemIndex}
                    cellSize={cellWidth}
                    thumbnailTier={thumbnailTier}
                    liteCell={liteCell}
                    isVisibleImage={isVisibleImage}
                    onSelect={onSelect}
                    onLiteZoom={onLiteZoom}
                  />
                );
              })}
            </div>
          );
        })}
        {loadMoreSentinel ? (
          <div className="absolute left-0 w-full" style={{ top: totalSize, height: LOAD_MORE_SENTINEL_HEIGHT }}>
            {loadMoreSentinel}
          </div>
        ) : null}
      </div>
    );
  },
);
