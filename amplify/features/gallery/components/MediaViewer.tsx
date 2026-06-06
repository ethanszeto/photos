"use client";

import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ViewerZoomableImage } from "@/features/gallery/components/ViewerZoomableImage";
import { noStoreFetchInit } from "@/shared/lib/no-store";
import type { MediaDetail, MediaItem } from "@/types";

type MediaViewerProps = {
  items: MediaItem[];
  initialIndex: number;
  onClose: () => void;
};

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function formatTakenAtBadge(takenAt: string, duration?: number, isVideo?: boolean): string {
  const label = new Date(takenAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  if (isVideo && duration != null) {
    return `${label} · ${formatDuration(duration)}`;
  }
  return label;
}

function useNeighborPreload(details: Map<string, MediaDetail>, items: MediaItem[], index: number) {
  useEffect(() => {
    const neighbors = [items[index - 1], items[index + 1]].filter(Boolean) as MediaItem[];
    const links: HTMLLinkElement[] = [];

    for (const item of neighbors) {
      const detail = details.get(item.id);
      if (!detail?.originalUrl) continue;

      const link = document.createElement("link");
      link.rel = "preload";
      link.as = item.mediaType === "video" ? "video" : "image";
      link.href = detail.originalUrl;
      document.head.appendChild(link);
      links.push(link);
    }

    return () => {
      for (const link of links) {
        document.head.removeChild(link);
      }
    };
  }, [details, items, index]);
}

/** Fullscreen viewer — independent from grid; only cares about current/neighbor items. */
export function MediaViewer({ items, initialIndex, onClose }: MediaViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [details, setDetails] = useState<Map<string, MediaDetail>>(new Map());
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  const detailsRef = useRef(details);
  const item = items[index];
  const detail = item ? details.get(item.id) : undefined;

  useNeighborPreload(details, items, index);

  useEffect(() => {
    detailsRef.current = details;
  }, [details]);

  useEffect(() => {
    if (!item) return;
    const itemId = item.id;
    if (detailsRef.current.has(itemId)) return;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`/api/media/${encodeURIComponent(itemId)}`, noStoreFetchInit);
        if (!response.ok) throw new Error("Failed to load media detail");
        const data = (await response.json()) as MediaDetail;
        if (!cancelled) {
          setDetails((current) => new Map(current).set(itemId, data));
          setFailedIds((current) => {
            if (!current.has(itemId)) return current;
            const next = new Set(current);
            next.delete(itemId);
            return next;
          });
        }
      } catch (error) {
        console.error("Media detail fetch error:", error);
        if (!cancelled) {
          setFailedIds((current) => new Set(current).add(itemId));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item]);

  const goNext = useCallback(() => {
    setIndex((current) => Math.min(current + 1, items.length - 1));
  }, [items.length]);

  const goPrev = useCallback(() => {
    setIndex((current) => Math.max(current - 1, 0));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") goNext();
      else if (event.key === "ArrowLeft") goPrev();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!item) return null;

  const displayDuration = detail?.duration ?? item.duration;
  const originalUrl = detail?.originalUrl;
  const isLoading = !originalUrl && !failedIds.has(item.id);

  return (
    <div
      className="fixed inset-0 z-50 box-border flex flex-col overflow-hidden overscroll-none bg-black pt-12 pb-4"
      data-media-viewer
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      <header className="shrink-0 bg-gradient-to-b from-black/80 via-black/50 to-transparent px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-white active:bg-white/20"
          >
            <ChevronLeft className="h-7 w-7 stroke-[2.5]" aria-hidden />
          </button>
          <div className="flex min-w-0 flex-1 justify-center px-1">
            <span className="w-fit max-w-full truncate rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white/90 backdrop-blur-md">
              {formatTakenAtBadge(item.takenAt, displayDuration, item.mediaType === "video")}
            </span>
          </div>
          <p className="shrink-0 text-sm tabular-nums text-white/70">
            {index + 1} / {items.length}
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-2">
        {isLoading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        ) : originalUrl ? (
          item.mediaType === "video" ? (
            <video key={item.id} src={originalUrl} controls playsInline className="max-h-full max-w-full object-contain" />
          ) : (
            <ViewerZoomableImage
              key={item.id}
              src={originalUrl}
              onSwipeLeft={goNext}
              onSwipeRight={goPrev}
            />
          )
        ) : (
          <p className="text-sm text-white/50">Unable to load media</p>
        )}
      </div>
    </div>
  );
}
