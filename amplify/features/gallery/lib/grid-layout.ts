import zoomConfig from "@/features/gallery/lib/zoom-levels.json";
import { SMALL_THUMBNAIL_MAX_PX } from "@/lib/media-constants";
import type { MediaItem } from "@/types";

export type ThumbnailTier = "mini" | "small" | "medium";

/** Display rules per zoom step — edit zoom-levels.json to add or tune levels. */
export const GALLERY_ZOOM_LEVELS = zoomConfig.levels;

export const ZOOM_LEVEL_COUNT = GALLERY_ZOOM_LEVELS.length;

export type ZoomLevel = (typeof GALLERY_ZOOM_LEVELS)[number]["level"];

export type ZoomOverscanSpec = (typeof GALLERY_ZOOM_LEVELS)[number]["overscan"];

export type ZoomLevelSpec = (typeof GALLERY_ZOOM_LEVELS)[number];

/** Inclusive index range of grid item indices. */
export type ImageIndexRange = {
  start: number;
  end: number;
};

/** Resolved metrics for one render frame — single source of truth for the gallery grid. */
export type GridLayoutMetrics = {
  zoomLevel: ZoomLevel;
  label: string;
  columns: number;
  gapPx: number;
  cellWidth: number;
  rowHeight: number;
  rowCount: number;
  overscan: number;
  gridTemplateColumns: string;
  thumbnailTier: ThumbnailTier;
  /** Tap zooms in (no viewer); see zoom-levels.json liteCell. */
  liteCell: boolean;
};

type VirtualRowSlice = {
  index: number;
  start: number;
  end: number;
};

export function getZoomLevelSpec(level: number): ZoomLevelSpec {
  const spec = GALLERY_ZOOM_LEVELS.find((entry) => entry.level === level);
  if (!spec) {
    throw new Error(`Unknown zoom level: ${level}`);
  }
  return spec;
}

export function getDefaultZoomLevel(): ZoomLevel {
  const match = GALLERY_ZOOM_LEVELS.find((entry) => entry.columns === zoomConfig.defaultLevelColumns);
  return (match?.level ?? Math.ceil(ZOOM_LEVEL_COUNT / 2)) as ZoomLevel;
}

export function clampZoomLevel(level: number): ZoomLevel {
  const clamped = Math.min(ZOOM_LEVEL_COUNT, Math.max(1, Math.round(level)));
  return clamped as ZoomLevel;
}

/** Narrow screens: 2-column level becomes single column. */
export function resolveColumns(specColumns: number, containerWidth: number): number {
  if (specColumns === 2 && containerWidth < 420) {
    return 1;
  }
  return specColumns;
}

export function getCellWidth(containerWidth: number, columns: number, gapPx: number): number {
  if (columns <= 0 || containerWidth <= 0) return 0;
  return (containerWidth - gapPx * (columns - 1)) / columns;
}

export function getRowHeight(containerWidth: number, columns: number, gapPx: number): number {
  return getCellWidth(containerWidth, columns, gapPx) + gapPx;
}

export function getRowCount(itemCount: number, columns: number): number {
  if (columns <= 0 || itemCount <= 0) return 0;
  return Math.ceil(itemCount / columns);
}

function getOverscanRowCount(
  viewportHeight: number,
  rowHeight: number,
  columns: number,
  spec: ZoomOverscanSpec,
): number {
  if (rowHeight <= 0) return spec.min;

  const rowsInView = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  const target = Math.ceil(rowsInView * spec.viewportMultiplier);
  const minAtLeastRowsInView = "minAtLeastRowsInView" in spec && spec.minAtLeastRowsInView === true;
  const minOverscan = minAtLeastRowsInView ? Math.min(rowsInView, spec.max) : spec.min;
  let overscan = Math.min(spec.max, Math.max(minOverscan, target));

  const maxMountedCells = "maxMountedCells" in spec ? spec.maxMountedCells : undefined;
  if (maxMountedCells != null && columns > 0) {
    const maxRows = Math.ceil(maxMountedCells / columns);
    const overscanCap = Math.max(0, Math.floor((maxRows - rowsInView) / 2));
    overscan = Math.min(overscan, overscanCap);
  }

  return overscan;
}

function shouldUseMediumThumbnail(cellWidth: number, devicePixelRatio: number): boolean {
  if (cellWidth <= 0) return false;
  return cellWidth * devicePixelRatio > SMALL_THUMBNAIL_MAX_PX * 0.92;
}

/** Pick thumbnail variant for a zoom step (mini tier from JSON overrides size heuristics). */
export function resolveThumbnailTier(
  spec: ZoomLevelSpec,
  cellWidth: number,
  devicePixelRatio: number,
): ThumbnailTier {
  if (spec.thumbnailTier === "mini") return "mini";
  if (shouldUseMediumThumbnail(cellWidth, devicePixelRatio)) return "medium";
  return "small";
}

export function getThumbnailUrl(item: MediaItem, tier: ThumbnailTier): string {
  switch (tier) {
    case "mini":
      return item.miniUrl;
    case "medium":
      return item.mediumUrl;
    case "small":
      return item.smallUrl;
  }
}

type GridPointLayout = {
  columns: number;
  cellWidth: number;
  rowHeight: number;
  gapPx: number;
};

/** Map a viewport client point to the nearest grid item index. */
export function clientPointToItemIndex(
  clientX: number,
  clientY: number,
  scrollElement: HTMLElement,
  layout: GridPointLayout,
  itemCount: number,
): number {
  if (itemCount <= 0 || layout.rowHeight <= 0 || layout.columns <= 0) return 0;

  const rect = scrollElement.getBoundingClientRect();
  const contentX = clientX - rect.left;
  const contentY = clientY - rect.top + scrollElement.scrollTop;
  const rowIndex = Math.max(0, Math.floor(contentY / layout.rowHeight));
  const columnStride = layout.cellWidth + layout.gapPx;
  const colIndex = Math.min(layout.columns - 1, Math.max(0, Math.floor(contentX / columnStride)));
  const index = rowIndex * layout.columns + colIndex;
  return Math.min(index, itemCount - 1);
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

/** CSS aspect-ratio value from media dimensions (defaults to square). */
export function getAspectRatioStyle(width?: number, height?: number): string {
  if (width != null && height != null && width > 0 && height > 0) {
    return `${width} / ${height}`;
  }
  return "1 / 1";
}

type ComputeGridLayoutInput = {
  zoomLevel: number;
  containerWidth: number;
  viewportHeight: number;
  devicePixelRatio?: number;
  itemCount: number;
};

/**
 * Single entry point for gallery grid sizing.
 * All gallery components consume this — no duplicate layout math elsewhere.
 */
export function computeGridLayout({
  zoomLevel,
  containerWidth,
  viewportHeight,
  devicePixelRatio = 1,
  itemCount,
}: ComputeGridLayoutInput): GridLayoutMetrics {
  const spec = getZoomLevelSpec(zoomLevel);
  const columns = resolveColumns(spec.columns, containerWidth);
  const gapPx = spec.gapPx;
  const cellWidth = getCellWidth(containerWidth, columns, gapPx);
  const rowHeight = getRowHeight(containerWidth, columns, gapPx);
  const overscan = getOverscanRowCount(viewportHeight, rowHeight, columns, spec.overscan);
  const thumbnailTier = resolveThumbnailTier(spec, cellWidth, devicePixelRatio);

  return {
    zoomLevel: spec.level as ZoomLevel,
    label: spec.label,
    columns,
    gapPx,
    cellWidth,
    rowHeight,
    rowCount: getRowCount(itemCount, columns),
    overscan,
    gridTemplateColumns: `repeat(${columns}, ${cellWidth}px)`,
    thumbnailTier,
    liteCell: spec.liteCell === true,
  };
}

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
