"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import type { GalleryPhoto } from "@/types";

type GalleryGridProps = {
  photos: GalleryPhoto[];
};

const ROW_HEIGHT = 128;
const GAP = 2;

function PhotoCell({ photo }: { photo: GalleryPhoto }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-sm bg-zinc-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-opacity duration-300"
      />
    </div>
  );
}

export function GalleryGrid({ photos }: GalleryGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columns = 3;
  const rowCount = Math.ceil(photos.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT + GAP,
    overscan: 4,
  });

  if (photos.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <p className="text-lg font-medium text-white/80">No Photos Yet</p>
        <p className="mt-2 max-w-xs text-sm text-white/50">Tap the upload button to add your first photo.</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto overscroll-contain px-0.5 pb-28"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowPhotos = photos.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 grid w-full grid-cols-3 gap-0.5 px-0.5"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {rowPhotos.map((photo) => (
                <PhotoCell key={photo.photoId} photo={photo} />
              ))}
              {rowPhotos.length < columns &&
                Array.from({ length: columns - rowPhotos.length }).map((_, i) => (
                  <div key={`empty-${virtualRow.index}-${i}`} className="aspect-square" aria-hidden />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
