"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { AlbumCard } from "@/components/albums/AlbumCard";
import type { Album } from "@/types";

type AlbumsPageProps = {
  initialAlbums: Album[];
};

export function AlbumsPage({ initialAlbums }: AlbumsPageProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-black text-white">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-black/80 px-4 py-3 backdrop-blur-xl">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Albums</h1>
          <p className="text-xs text-white/50">
            {initialAlbums.length === 0
              ? "No albums"
              : `${initialAlbums.length} album${initialAlbums.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          aria-label="Lock"
          className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 active:bg-white/15"
        >
          <Lock className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-bottom-nav [-webkit-overflow-scrolling:touch]" data-albums-scroll>
        {initialAlbums.length === 0 ? (
          <div className="flex h-full min-h-[50vh] flex-col items-center justify-center px-6 text-center">
            <p className="text-lg font-medium text-white/80">No Albums Yet</p>
            <p className="mt-2 max-w-xs text-sm text-white/50">Albums will appear here as you add photos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:gap-4">
            {initialAlbums.map((album) => (
              <AlbumCard key={`${album.type}-${album.id}`} album={album} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
