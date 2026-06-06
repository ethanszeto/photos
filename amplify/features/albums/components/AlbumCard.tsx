import Link from "next/link";
import type { Album } from "@/types";

type AlbumCardProps = {
  album: Album;
};

export function AlbumCard({ album }: AlbumCardProps) {
  return (
    <Link
      href={`/albums/${album.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 transition-transform active:scale-[0.98]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-white/5">
        {album.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={album.coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/30">No cover</div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-base font-semibold tracking-tight text-white">{album.name}</p>
      </div>
    </Link>
  );
}
