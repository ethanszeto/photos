"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MediaGridPage } from "@/features/gallery/components/MediaGridPage";
import type { Album, MediaItem } from "@/types";

type AlbumDetailPageProps = {
  album: Album;
  initialItems: MediaItem[];
  initialCursor: string | null;
};

export function AlbumDetailPage({ album, initialItems, initialCursor }: AlbumDetailPageProps) {
  return (
    <MediaGridPage
      title={album.name}
      initialItems={initialItems}
      initialCursor={initialCursor}
      apiPath={`/api/albums/${album.id}`}
      headerLeading={
        <Link
          href="/albums"
          aria-label="Back to albums"
          className="-ml-1 rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 active:bg-white/15"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
      }
      emptyTitle="No Items"
      emptyDescription="This album is empty."
    />
  );
}
