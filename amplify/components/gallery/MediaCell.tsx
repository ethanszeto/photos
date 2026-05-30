"use client";

import { memo, useEffect, useRef, useState, type RefObject } from "react";
import { getAspectRatioStyle } from "@/lib/grid-layout";
import type { MediaItem } from "@/types";

type MediaCellProps = {
  item: MediaItem;
  cellSize: number;
  useMediumThumbnail: boolean;
  scrollRootRef: RefObject<HTMLElement | null>;
  /** IntersectionObserver prefetch band — from getImagePrefetchRootMargin(viewportHeight). */
  imagePrefetchMargin: string;
  onSelect: (item: MediaItem) => void;
};

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

/**
 * Fixed-size grid cell: placeholder shell always mounted; image only near viewport.
 */
export const MediaCell = memo(function MediaCell({
  item,
  cellSize,
  useMediumThumbnail,
  scrollRootRef,
  imagePrefetchMargin,
  onSelect,
}: MediaCellProps) {
  const shellRef = useRef<HTMLButtonElement>(null);
  const [shouldLoadImage, setShouldLoadImage] = useState(false);
  const thumbnailUrl = useMediumThumbnail ? item.mediumUrl : item.smallUrl;

  useEffect(() => {
    const node = shellRef.current;
    const root = scrollRootRef.current;
    if (!node || !root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoadImage(true);
        }
      },
      { root, rootMargin: imagePrefetchMargin, threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [scrollRootRef, imagePrefetchMargin]);

  return (
    <button
      ref={shellRef}
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
        {shouldLoadImage && thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            loading="eager"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : null}
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
