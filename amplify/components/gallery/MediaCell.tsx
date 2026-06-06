"use client";

import { memo } from "react";
import { GridCellImage } from "@/components/gallery/GridCellImage";
import { getAspectRatioStyle, type ThumbnailTier } from "@/lib/gallery-grid-layout";
import type { MediaItem } from "@/types";

type MediaCellProps = {
  item: MediaItem;
  itemIndex: number;
  cellSize: number;
  thumbnailTier: ThumbnailTier;
  liteCell: boolean;
  isVisibleImage: boolean;
  onSelect: (item: MediaItem) => void;
  onLiteZoom: (itemIndex: number) => void;
};

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

/**
 * Fixed-size grid cell. Only mounted rows exist (virtualizer); thumbnails load on mount.
 */
export const MediaCell = memo(function MediaCell({
  item,
  itemIndex,
  cellSize,
  thumbnailTier,
  liteCell,
  isVisibleImage,
  onSelect,
  onLiteZoom,
}: MediaCellProps) {
  const image = <GridCellImage item={item} thumbnailTier={thumbnailTier} isVisible={isVisibleImage} />;

  if (liteCell) {
    return (
      <div
        role="presentation"
        onClick={() => onLiteZoom(itemIndex)}
        className="relative shrink-0 cursor-default overflow-hidden bg-zinc-900 active:opacity-90"
        style={{ width: cellSize, height: cellSize }}
      >
        {image}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="relative shrink-0 overflow-hidden bg-zinc-900 active:opacity-90"
      style={{ width: cellSize, height: cellSize }}
      aria-label={`Open ${item.mediaType} taken ${item.takenAt}`}
    >
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ aspectRatio: getAspectRatioStyle(item.width, item.height) }}
      >
        {image}
      </div>

      {item.mediaType === "video" && item.duration != null && (
        <span className="absolute bottom-1 right-1 rounded px-1 py-0.5 text-[10px] font-medium leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {formatDuration(item.duration)}
        </span>
      )}

      {item.mediaType === "gif" && (
        <span className="absolute bottom-1 right-1 rounded bg-black/50 px-1 py-0.5 text-[10px] font-semibold leading-none text-white">
          GIF
        </span>
      )}
    </button>
  );
});

/** Empty slot preserving row geometry in the last partial row. */
export function MediaCellPlaceholder({ cellSize }: { cellSize: number }) {
  return <div className="shrink-0 bg-zinc-900" style={{ width: cellSize, height: cellSize }} aria-hidden />;
}
