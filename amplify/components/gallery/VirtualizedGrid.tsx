"use client";

import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { MediaCell, MediaCellPlaceholder } from "@/components/gallery/MediaCell";
import { GRID_GAP_PX } from "@/lib/media-constants";
import {
  getCenterItemIndex,
  getCellWidth,
  getImagePrefetchRootMargin,
  getOverscanRowCount,
  getRowCount,
  getRowHeight,
} from "@/lib/grid-layout";
import type { MediaItem } from "@/types";

export type VirtualizedGridHandle = {
  scrollToItemIndex: (index: number, options?: { align?: "start" | "center"; behavior?: ScrollBehavior }) => void;
  getFirstVisibleItemIndex: () => number;
  getCenterItemIndex: () => number;
  getVirtualizer: () => Virtualizer<HTMLDivElement, Element> | null;
};

/** Height reserved below the virtualized rows for the infinite-scroll sentinel. */
const LOAD_MORE_SENTINEL_HEIGHT = 80;

type VirtualizedGridProps = {
  items: MediaItem[];
  columns: number;
  useMediumThumbnail: boolean;
  onSelect: (item: MediaItem) => void;
  parentRef: RefObject<HTMLDivElement | null>;
  loadMoreSentinel?: React.ReactNode;
};

type LayoutSnapshot = {
  columns: number;
  rowHeight: number;
  containerWidth: number;
};

/**
 * Row virtualizer with fixed row stride (no measureElement).
 * Scroll height is deterministic; unmounted rows are accounted for in totalSize only.
 */
export const VirtualizedGrid = forwardRef<VirtualizedGridHandle, VirtualizedGridProps>(function VirtualizedGrid(
  { items, columns, useMediumThumbnail, onSelect, parentRef, loadMoreSentinel },
  ref,
) {
  const [containerWidth, setContainerWidth] = useState(360);
  const [viewportHeight, setViewportHeight] = useState(800);
  const layoutSnapshot = useRef<LayoutSnapshot | null>(null);

  const cellWidth = getCellWidth(containerWidth, columns);
  const rowHeight = getRowHeight(containerWidth, columns);
  const rowCount = getRowCount(items.length, columns);
  const overscan = getOverscanRowCount(viewportHeight, rowHeight);
  const imagePrefetchMargin = getImagePrefetchRootMargin(viewportHeight);

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const update = () => {
      setContainerWidth(element.clientWidth);
      setViewportHeight(element.clientHeight);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [parentRef]);

  const getScrollElement = useCallback(() => parentRef.current, [parentRef]);

  const getItemKey = useCallback(
    (rowIndex: number) => {
      const first = items[rowIndex * columns];
      return first?.id ?? `row-${rowIndex}`;
    },
    [items, columns],
  );

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement,
    estimateSize: () => rowHeight,
    overscan,
    getItemKey,
  });

  // Apply fixed row stride when tile size changes (no DOM measurement).
  useEffect(() => {
    if (rowHeight <= 0 || rowCount <= 0) return;
    for (let i = 0; i < rowCount; i++) {
      virtualizer.resizeItem(i, rowHeight);
    }
    // rowCount intentionally omitted — new rows pick up estimateSize(); only re-sync on stride change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rowCount read for current virtual range only
  }, [rowHeight, virtualizer]);

  const getCenterIndex = useCallback(() => {
    const scrollEl = parentRef.current;
    if (!scrollEl) return 0;
    return getCenterItemIndex(scrollEl.scrollTop, scrollEl.clientHeight, rowHeight, columns, items.length);
  }, [parentRef, rowHeight, columns, items.length]);

  // Preserve focal item when zoom or resize changes column count / row height.
  useLayoutEffect(() => {
    const scrollEl = parentRef.current;
    if (!scrollEl || rowCount === 0) return;

    const prev = layoutSnapshot.current;
    const next: LayoutSnapshot = { columns, rowHeight, containerWidth };

    if (prev && (prev.columns !== columns || prev.rowHeight !== rowHeight)) {
      const centerIndex = getCenterItemIndex(
        scrollEl.scrollTop,
        scrollEl.clientHeight,
        prev.rowHeight,
        prev.columns,
        items.length,
      );
      const rowIndex = Math.floor(centerIndex / columns);
      virtualizer.scrollToIndex(rowIndex, { align: "center", behavior: "auto" });
    }

    layoutSnapshot.current = next;
  }, [columns, rowHeight, containerWidth, rowCount, items.length, virtualizer, parentRef]);

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

  const gridTemplateColumns = useMemo(() => `repeat(${columns}, ${cellWidth}px)`, [columns, cellWidth]);
  const totalSize = virtualizer.getTotalSize();
  const scrollHeight = totalSize + (loadMoreSentinel ? LOAD_MORE_SENTINEL_HEIGHT : 0);

  return (
    <div
      style={{
        height: `${scrollHeight}px`,
        width: "100%",
        position: "relative",
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const startIndex = virtualRow.index * columns;

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
              gap: `${GRID_GAP_PX}px`,
            }}
          >
            {Array.from({ length: columns }, (_, col) => {
              const item = items[startIndex + col];
              if (!item) {
                return <MediaCellPlaceholder key={`empty-${virtualRow.index}-${col}`} cellSize={cellWidth} />;
              }
              return (
                <MediaCell
                  key={item.id}
                  item={item}
                  cellSize={cellWidth}
                  useMediumThumbnail={useMediumThumbnail}
                  scrollRootRef={parentRef}
                  imagePrefetchMargin={imagePrefetchMargin}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        );
      })}
      {loadMoreSentinel ? (
        <div
          className="absolute left-0 w-full"
          style={{ top: totalSize, height: LOAD_MORE_SENTINEL_HEIGHT }}
        >
          {loadMoreSentinel}
        </div>
      ) : null}
    </div>
  );
});
