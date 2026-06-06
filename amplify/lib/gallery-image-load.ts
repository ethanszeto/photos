/** Inclusive index range of grid item indices. */
export type ImageIndexRange = {
  start: number;
  end: number;
};

type VirtualRowSlice = {
  index: number;
  start: number;
  end: number;
};

/**
 * Indices intersecting the viewport, derived from virtual row geometry.
 * Mounted cells always load thumbnails; this range only drives fetch priority.
 */
export function computeVisibleImageRange(
  virtualRows: VirtualRowSlice[],
  scrollOffset: number,
  viewportHeight: number,
  columns: number,
  itemCount: number,
): ImageIndexRange {
  if (virtualRows.length === 0 || itemCount === 0 || columns <= 0) {
    return { start: 0, end: 0 };
  }

  const viewportEnd = scrollOffset + viewportHeight;
  const visibleRows = virtualRows.filter((row) => row.end > scrollOffset && row.start < viewportEnd);

  if (visibleRows.length === 0) {
    const firstRow = virtualRows[0].index;
    const lastRow = virtualRows[virtualRows.length - 1].index;
    return {
      start: firstRow * columns,
      end: Math.min(itemCount - 1, (lastRow + 1) * columns - 1),
    };
  }

  return {
    start: visibleRows[0].index * columns,
    end: Math.min(itemCount - 1, (visibleRows[visibleRows.length - 1].index + 1) * columns - 1),
  };
}

export function isIndexInRange(index: number, range: ImageIndexRange): boolean {
  return index >= range.start && index <= range.end;
}

/** Visible index overlap for one virtual row (avoids per-cell range math). */
export function rowVisibleOverlap(
  rowIndex: number,
  columns: number,
  itemCount: number,
  visible: ImageIndexRange,
): ImageIndexRange | null {
  const rowStart = rowIndex * columns;
  const rowEnd = Math.min(itemCount - 1, (rowIndex + 1) * columns - 1);
  const start = Math.max(rowStart, visible.start);
  const end = Math.min(rowEnd, visible.end);
  if (start > end) return null;
  return { start, end };
}
