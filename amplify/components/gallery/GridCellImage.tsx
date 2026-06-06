"use client";

import { memo } from "react";
import { getThumbnailUrl, type ThumbnailTier } from "@/lib/gallery-grid-layout";
import type { MediaItem } from "@/types";

type GridCellImageProps = {
  item: MediaItem;
  thumbnailTier: ThumbnailTier;
  isVisible: boolean;
};

/** Thumbnail for a mounted cell — unmount releases the <img> and decoded bitmap. */
export const GridCellImage = memo(function GridCellImage({ item, thumbnailTier, isVisible }: GridCellImageProps) {
  const thumbnailUrl = getThumbnailUrl(item, thumbnailTier);
  if (!thumbnailUrl) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbnailUrl}
      alt=""
      decoding="async"
      draggable={false}
      fetchPriority={isVisible ? "high" : "low"}
      className="h-full w-full object-cover"
    />
  );
});
