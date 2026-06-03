import { GRID_GAP_PX } from "@/lib/media-constants";

/** Square tile width for a given container and column count. */
export function getCellWidth(containerWidth: number, columns: number): number {
  if (columns <= 0 || containerWidth <= 0) return 0;
  return (containerWidth - GRID_GAP_PX * (columns - 1)) / columns;
}

/** Fixed row stride — must match rendered row height exactly (no post-load measurement). */
export function getRowHeight(containerWidth: number, columns: number): number {
  return getCellWidth(containerWidth, columns) + GRID_GAP_PX;
}

export function getRowCount(itemCount: number, columns: number): number {
  if (columns <= 0 || itemCount <= 0) return 0;
  return Math.ceil(itemCount / columns);
}

/** Item index closest to the vertical center of the viewport. */
export function getCenterItemIndex(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  columns: number,
  itemCount: number,
): number {
  if (itemCount <= 0 || rowHeight <= 0 || columns <= 0) return 0;
  const centerY = scrollTop + viewportHeight / 2;
  const rowIndex = Math.max(0, Math.floor(centerY / rowHeight));
  const index = rowIndex * columns + Math.floor(columns / 2);
  return Math.min(index, itemCount - 1);
}

/** Rows mounted above/below the visible slice (tanstack virtual overscan). */
export function getOverscanRowCount(viewportHeight: number, rowHeight: number): number {
  if (rowHeight <= 0) return 10;
  const rowsInView = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  // ~2.5 screens each side — enough for medium-speed flick scroll without huge DOM cost.
  const overscan = Math.ceil(rowsInView * 2.5);
  return Math.min(28, Math.max(10, overscan));
}

/** IntersectionObserver rootMargin for thumbnail prefetch (vertical only). */
export function getImagePrefetchRootMargin(viewportHeight: number): string {
  const px = Math.min(1200, Math.max(640, Math.round(viewportHeight * 0.9)));
  return `${px}px 0px`;
}

/** CSS aspect-ratio value from media dimensions (defaults to square). */
export function getAspectRatioStyle(width?: number, height?: number): string {
  if (width != null && height != null && width > 0 && height > 0) {
    return `${width} / ${height}`;
  }
  return "1 / 1";
}
