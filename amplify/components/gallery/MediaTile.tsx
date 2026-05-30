"use client";

import { memo } from "react";
import type { MediaItem } from "@/types";

type MediaTileProps = {
  item: MediaItem;
  useMediumThumbnail: boolean;
  onSelect: (item: MediaItem) => void;
};

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

/**
 * Memoized grid cell — only re-renders when its item or thumbnail tier changes.
 * Uses CloudFront URLs stored in DynamoDB; never loads the original asset.
 */
export const MediaTile = memo(function MediaTile({ item, useMediumThumbnail, onSelect }: MediaTileProps) {
  const thumbnailUrl = useMediumThumbnail ? item.mediumUrl : item.smallUrl;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group relative aspect-square w-full overflow-hidden bg-neutral-100 transition-[transform,opacity] duration-200 ease-out active:opacity-90"
      aria-label={`Open ${item.mediaType} taken ${item.takenAt}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnailUrl}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
      />

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
