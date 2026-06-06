"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { getThumbnailUrl, type ThumbnailTier } from "@/features/gallery/lib/grid-layout";
import { releaseThumbnailLoad, requestThumbnailLoad } from "@/features/gallery/lib/thumbnail-load-gate";
import type { MediaItem } from "@/types";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 400;

type GridCellImageProps = {
  item: MediaItem;
  thumbnailTier: ThumbnailTier;
  /** True only for cells intersecting the viewport — overscan cells stay as placeholders. */
  isVisible: boolean;
};

function retryUrl(url: string, attempt: number): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_retry=${attempt}`;
}

/**
 * Viewport-only thumbnail. Overscan mounted cells render a placeholder (no network).
 * A small concurrency gate prevents 503 storms on Safari at 32-column zoom.
 */
export const GridCellImage = memo(function GridCellImage({ item, thumbnailTier, isVisible }: GridCellImageProps) {
  const thumbnailUrl = getThumbnailUrl(item, thumbnailTier);
  const [src, setSrc] = useState<string | null>(null);
  const retriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRequestRef = useRef<(() => void) | null>(null);
  const loadId = item.id;

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current != null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const beginLoad = useCallback(
    (url: string) => {
      cancelRequestRef.current?.();
      cancelRequestRef.current = requestThumbnailLoad(loadId, 0, () => {
        setSrc(url);
      });
    },
    [loadId],
  );

  useEffect(() => {
    if (!thumbnailUrl || !isVisible) {
      clearRetryTimer();
      cancelRequestRef.current?.();
      cancelRequestRef.current = null;
      releaseThumbnailLoad(loadId);
      setSrc(null);
      retriesRef.current = 0;
      return;
    }

    retriesRef.current = 0;
    beginLoad(thumbnailUrl);

    return () => {
      clearRetryTimer();
      cancelRequestRef.current?.();
      cancelRequestRef.current = null;
      releaseThumbnailLoad(loadId);
      setSrc(null);
    };
  }, [thumbnailUrl, isVisible, loadId, beginLoad, clearRetryTimer]);

  const handleDone = () => {
    releaseThumbnailLoad(loadId);
  };

  const handleError = () => {
    releaseThumbnailLoad(loadId);
    setSrc(null);

    if (retriesRef.current >= MAX_RETRIES || !thumbnailUrl || !isVisible) return;

    retriesRef.current += 1;
    const attempt = retriesRef.current;
    clearRetryTimer();

    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (!isVisible) return;
      beginLoad(retryUrl(thumbnailUrl, attempt));
    }, RETRY_BASE_MS * attempt);
  };

  if (!src) {
    return <div className="h-full w-full bg-zinc-900" aria-hidden />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      decoding="async"
      draggable={false}
      fetchPriority="high"
      className="h-full w-full object-cover"
      onLoad={handleDone}
      onError={handleError}
    />
  );
});
