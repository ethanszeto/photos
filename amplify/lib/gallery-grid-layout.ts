import zoomConfig from "@/lib/gallery-zoom-levels.json";
import { SMALL_THUMBNAIL_MAX_PX } from "@/lib/media-constants";

/** Display rules per zoom step — edit gallery-zoom-levels.json to add or tune levels. */
export const GALLERY_ZOOM_LEVELS = zoomConfig.levels;

export const ZOOM_LEVEL_COUNT = GALLERY_ZOOM_LEVELS.length;

export type ZoomLevel = (typeof GALLERY_ZOOM_LEVELS)[number]["level"];

export type ZoomOverscanSpec = (typeof GALLERY_ZOOM_LEVELS)[number]["overscan"];

export type ZoomLevelSpec = (typeof GALLERY_ZOOM_LEVELS)[number];

/** Resolved metrics for one render frame (virtualizer + cells + thumbnails). */
export type GridLayoutMetrics = {
  zoomLevel: ZoomLevel;
  label: string;
  columns: number;
  gapPx: number;
  cellWidth: number;
  rowHeight: number;
  overscan: number;
  gridTemplateColumns: string;
  useMediumThumbnail: boolean;
  imagePrefetchMargin: string;
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

/** Tile width after subtracting horizontal gaps between columns. */
export function getCellWidth(containerWidth: number, columns: number, gapPx: number): number {
  if (columns <= 0 || containerWidth <= 0) return 0;
  return (containerWidth - gapPx * (columns - 1)) / columns;
}

/** Fixed virtual row stride — cell height plus vertical gap between rows. */
export function getRowHeight(containerWidth: number, columns: number, gapPx: number): number {
  return getCellWidth(containerWidth, columns, gapPx) + gapPx;
}

export function getRowCount(itemCount: number, columns: number): number {
  if (columns <= 0 || itemCount <= 0) return 0;
  return Math.ceil(itemCount / columns);
}

function getOverscanRowCount(viewportHeight: number, rowHeight: number, spec: ZoomOverscanSpec): number {
  if (rowHeight <= 0) return spec.min;

  const rowsInView = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  const target = Math.ceil(rowsInView * spec.viewportMultiplier);
  const minOverscan = spec.minAtLeastRowsInView ? Math.min(rowsInView, spec.max) : spec.min;
  return Math.min(spec.max, Math.max(minOverscan, target));
}

export function shouldUseMediumThumbnail(cellWidth: number, devicePixelRatio: number): boolean {
  if (cellWidth <= 0) return false;
  return cellWidth * devicePixelRatio > SMALL_THUMBNAIL_MAX_PX * 0.92;
}

/** IntersectionObserver rootMargin for thumbnail prefetch (vertical only). */
export function getImagePrefetchRootMargin(viewportHeight: number): string {
  const px = Math.min(1200, Math.max(640, Math.round(viewportHeight * 0.9)));
  return `${px}px 0px`;
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
};

/**
 * Single entry point for gallery grid sizing — reads zoom JSON and returns
 * everything VirtualizedGrid and thumbnail tier need for one frame.
 */
export function computeGridLayout({
  zoomLevel,
  containerWidth,
  viewportHeight,
  devicePixelRatio = 1,
}: ComputeGridLayoutInput): GridLayoutMetrics {
  const spec = getZoomLevelSpec(zoomLevel);
  const columns = resolveColumns(spec.columns, containerWidth);
  const gapPx = spec.gapPx;
  const cellWidth = getCellWidth(containerWidth, columns, gapPx);
  const rowHeight = getRowHeight(containerWidth, columns, gapPx);
  const overscan = getOverscanRowCount(viewportHeight, rowHeight, spec.overscan);

  return {
    zoomLevel: spec.level as ZoomLevel,
    label: spec.label,
    columns,
    gapPx,
    cellWidth,
    rowHeight,
    overscan,
    gridTemplateColumns: `repeat(${columns}, ${cellWidth}px)`,
    useMediumThumbnail: shouldUseMediumThumbnail(cellWidth, devicePixelRatio),
    imagePrefetchMargin: getImagePrefetchRootMargin(viewportHeight),
  };
}
