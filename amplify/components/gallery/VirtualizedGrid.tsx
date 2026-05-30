"use client";

import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, type RefObject } from "react";
import { MediaTile } from "@/components/gallery/MediaTile";
import type { MediaItem } from "@/types";

const GRID_GAP_PX = 2;

export type VirtualizedGridHandle = {
  scrollToItemIndex: (index: number) => void;
  getFirstVisibleItemIndex: () => number;
  getVirtualizer: () => Virtualizer<HTMLDivElement, Element> | null;
};

type VirtualizedGridProps = {
  items: MediaItem[];
  columns: number;
  useMediumThumbnail: boolean;
  onSelect: (item: MediaItem) => void;
  parentRef: RefObject<HTMLDivElement | null>;
  loadMoreSentinel?: React.ReactNode;
};

/**
 * Row-based virtualizer — only mounts visible rows plus overscan.
 * Row count = ceil(n / columns), so 25k items at 12 columns ≈ 2,084 rows.
 */
export const VirtualizedGrid = forwardRef<VirtualizedGridHandle, VirtualizedGridProps>(function VirtualizedGrid(
  { items, columns, useMediumThumbnail, onSelect, parentRef, loadMoreSentinel },
  ref,
) {
  const rowCount = Math.ceil(items.length / columns) || 0;

  const estimateRowHeight = useCallback(() => {
    const containerWidth = parentRef.current?.clientWidth ?? 360;
    const cellWidth = (containerWidth - GRID_GAP_PX * (columns - 1)) / columns;
    return cellWidth + GRID_GAP_PX;
  }, [columns, parentRef]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateRowHeight,
    overscan: 3,
  });

  // Re-measure rows when column density changes (zoom level).
  useEffect(() => {
    virtualizer.measure();
  }, [columns, virtualizer]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToItemIndex(index: number) {
        const rowIndex = Math.floor(index / columns);
        virtualizer.scrollToIndex(rowIndex, { align: "start", behavior: "smooth" });
      },
      getFirstVisibleItemIndex() {
        const firstRow = virtualizer.getVirtualItems()[0];
        if (!firstRow) return 0;
        return firstRow.index * columns;
      },
      getVirtualizer() {
        return virtualizer;
      },
    }),
    [virtualizer, columns],
  );

  const gridTemplateColumns = useMemo(() => `repeat(${columns}, minmax(0, 1fr))`, [columns]);

  return (
    <>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = items.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                display: "grid",
                gridTemplateColumns,
                gap: `${GRID_GAP_PX}px`,
                willChange: "transform",
              }}
            >
              {rowItems.map((item) => (
                <MediaTile
                  key={item.id}
                  item={item}
                  useMediumThumbnail={useMediumThumbnail}
                  onSelect={onSelect}
                />
              ))}
            </div>
          );
        })}
      </div>
      {loadMoreSentinel}
    </>
  );
});
