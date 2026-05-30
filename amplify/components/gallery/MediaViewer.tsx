"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/types";

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

/** Preload neighboring originals so swipe/keyboard navigation feels instant. */
function useNeighborPreload(items: MediaItem[], index: number) {
  useEffect(() => {
    const neighbors = [items[index - 1], items[index + 1]].filter(Boolean) as MediaItem[];
    const links: HTMLLinkElement[] = [];

    for (const item of neighbors) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = item.mediaType === "video" ? "video" : "image";
      link.href = item.originalUrl;
      document.head.appendChild(link);
      links.push(link);
    }

    return () => {
      for (const link of links) {
        document.head.removeChild(link);
      }
    };
  }, [items, index]);
}

/**
 * Fullscreen detail viewer with keyboard + swipe navigation.
 * Loads the original CloudFront URL — thumbnails are never used here.
 */
export function MediaViewer({ items, initialIndex, onClose }: MediaViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const item = items[index];

  useNeighborPreload(items, index);

  const goNext = useCallback(() => {
    setIndex((current) => Math.min(current + 1, items.length - 1));
  }, [items.length]);

  const goPrev = useCallback(() => {
    setIndex((current) => Math.max(current - 1, 0));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight") {
        goNext();
      } else if (event.key === "ArrowLeft") {
        goPrev();
      }
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

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
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
      <header className="flex items-center justify-between px-4 py-3 text-white">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          Done
        </button>
        <p className="text-sm text-white/70">
          {index + 1} / {items.length}
        </p>
        <div className="w-16" aria-hidden />
      </header>

      <div className="flex flex-1 items-center justify-center px-2 pb-6">
        {item.mediaType === "video" ? (
          <video
            key={item.id}
            src={item.originalUrl}
            controls
            playsInline
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={item.originalUrl}
            alt=""
            className="max-h-full max-w-full object-contain select-none"
            draggable={false}
          />
        )}
      </div>

      <footer className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-white/60">
        {new Date(item.takenAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        {item.mediaType === "video" && item.duration != null && (
          <span className="ml-2">· {formatDuration(item.duration)}</span>
        )}
      </footer>
    </div>
  );
}
