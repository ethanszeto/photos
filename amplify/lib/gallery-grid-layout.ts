import zoomConfig from "@/lib/gallery-zoom-levels.json";
import { SMALL_THUMBNAIL_MAX_PX } from "@/lib/media-constants";
import type { MediaItem } from "@/types";

export type ThumbnailTier = "mini" | "small" | "medium";

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
  thumbnailTier: ThumbnailTier;
  /** IntersectionObserver band for mounting <img> elements (tighter than virtual overscan). */
  imageLoadMargin: string;
  /** Tap zooms in (no viewer); see gallery-zoom-levels.json liteCell. */
  liteCell: boolean;
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

export function shouldUseMediumThumbnail(cellWidth: number, devicePixelRatio: number): boolean {
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

/** Vertical rootMargin for when cells mount/unmount thumbnail images. */
export function getImageLoadRootMargin(viewportHeight: number, thumbnailTier: ThumbnailTier): string {
  if (thumbnailTier === "mini") {
    const px = Math.min(160, Math.max(48, Math.round(viewportHeight * 0.15)));
    return `${px}px 0px`;
  }
  const px = Math.min(800, Math.max(400, Math.round(viewportHeight * 0.6)));
  return `${px}px 0px`;
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
  const colIndex = Math.min(
    layout.columns - 1,
    Math.max(0, Math.floor(contentX / columnStride)),
  );
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
  const overscan = getOverscanRowCount(viewportHeight, rowHeight, columns, spec.overscan);
  const thumbnailTier = resolveThumbnailTier(spec, cellWidth, devicePixelRatio);

  return {
    zoomLevel: spec.level as ZoomLevel,
    label: spec.label,
    columns,
    gapPx,
    cellWidth,
    rowHeight,
    overscan,
    gridTemplateColumns: `repeat(${columns}, ${cellWidth}px)`,
    thumbnailTier,
    imageLoadMargin: getImageLoadRootMargin(viewportHeight, thumbnailTier),
    liteCell: spec.liteCell === true,
  };
}
