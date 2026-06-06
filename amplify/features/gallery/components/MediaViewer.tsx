"use client";

import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);
  const item = items[index];
  const detail = item ? details.get(item.id) : undefined;

  useNeighborPreload(details, items, index);

  useEffect(() => {
    if (!item || details.has(item.id)) return;

    let cancelled = false;
    setLoadingId(item.id);

    void (async () => {
      try {
        const response = await fetch(`/api/media/${encodeURIComponent(item.id)}`, noStoreFetchInit);
        if (!response.ok) throw new Error("Failed to load media detail");
        const data = (await response.json()) as MediaDetail;
        if (!cancelled) {
          setDetails((current) => new Map(current).set(item.id, data));
        }
      } catch (error) {
        console.error("Media detail fetch error:", error);
      } finally {
        if (!cancelled) {
          setLoadingId((current) => (current === item.id ? null : current));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item, details]);

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
  const isLoading = loadingId === item.id && !originalUrl;

  return (
    <div
      className="content content-safe-bottom fixed inset-0 z-50 box-border flex flex-col overflow-hidden overscroll-none bg-black"
      data-media-viewer
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const startX = touchStartX.current;
        const endX = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (startX == null || endX == null) return;

        const delta = endX - startX;
        if (Math.abs(delta) < 48) return;
        if (delta < 0) goNext();
        else goPrev();
      }}
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={item.id}
              src={originalUrl}
              alt=""
              className="max-h-full max-w-full object-contain select-none"
              draggable={false}
            />
          )
        ) : (
          <p className="text-sm text-white/50">Unable to load media</p>
        )}
      </div>
    </div>
  );
}
