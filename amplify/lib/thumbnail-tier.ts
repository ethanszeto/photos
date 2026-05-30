import { GRID_GAP_PX, SMALL_THUMBNAIL_MAX_PX } from "@/lib/media-constants";

/**
 * Use medium CloudFront thumbs only when the on-screen tile (× DPR) exceeds
 * what the small (~300px) variant can represent without upscaling blur.
 */
export function shouldUseMediumThumbnail(containerWidth: number, columns: number, devicePixelRatio: number): boolean {
  if (columns <= 0 || containerWidth <= 0) return false;

  const cellWidth = (containerWidth - GRID_GAP_PX * (columns - 1)) / columns;
  const displayPixels = cellWidth * devicePixelRatio;
  return displayPixels > SMALL_THUMBNAIL_MAX_PX * 0.92;
}
