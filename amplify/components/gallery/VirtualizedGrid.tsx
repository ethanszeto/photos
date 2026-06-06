"use client";

import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";
import { MediaCell, MediaCellPlaceholder } from "@/components/gallery/MediaCell";
import { getCenterItemIndex, getRowCount, type GridLayoutMetrics } from "@/lib/gallery-grid-layout";
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
  layout: GridLayoutMetrics;
  awarenessFocalItemIndex: number | null;
  onAwarenessFocalApplied: () => void;
  onSelect: (item: MediaItem) => void;
  onLiteZoom: (itemIndex: number) => void;
  parentRef: RefObject<HTMLDivElement | null>;
  loadMoreSentinel?: React.ReactNode;
};

type LayoutSnapshot = {
  columns: number;
  rowHeight: number;
  gapPx: number;
};

/**
 * Row virtualizer with fixed row stride (no measureElement).
 * All sizing comes from layout (gallery-zoom-levels.json + computeGridLayout).
 */
export const VirtualizedGrid = forwardRef<VirtualizedGridHandle, VirtualizedGridProps>(function VirtualizedGrid(
  { items, layout, awarenessFocalItemIndex, onAwarenessFocalApplied, onSelect, onLiteZoom, parentRef, loadMoreSentinel },
  ref,
) {
  const layoutSnapshot = useRef<LayoutSnapshot | null>(null);

  const {
    columns,
    gapPx,
    cellWidth,
    rowHeight,
    overscan,
    gridTemplateColumns,
    useMediumThumbnail,
    imagePrefetchMargin,
    liteCell,
  } = layout;
  const rowCount = getRowCount(items.length, columns);

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
    const next: LayoutSnapshot = { columns, rowHeight, gapPx };

    if (prev && (prev.columns !== columns || prev.rowHeight !== rowHeight || prev.gapPx !== gapPx)) {
      const focalIndex =
        awarenessFocalItemIndex ??
        getCenterItemIndex(scrollEl.scrollTop, scrollEl.clientHeight, prev.rowHeight, prev.columns, items.length);
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
              gap: rowGapStyle,
            }}
          >
            {Array.from({ length: columns }, (_, col) => {
              const item = items[startIndex + col];
              if (!item) {
                return <MediaCellPlaceholder key={`empty-${virtualRow.index}-${col}`} cellSize={cellWidth} />;
              }
              const itemIndex = startIndex + col;
              return (
                <MediaCell
                  key={item.id}
                  item={item}
                  itemIndex={itemIndex}
                  cellSize={cellWidth}
                  useMediumThumbnail={useMediumThumbnail}
                  scrollRootRef={parentRef}
                  imagePrefetchMargin={imagePrefetchMargin}
                  liteCell={liteCell}
                  onSelect={onSelect}
                  onLiteZoom={onLiteZoom}
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
