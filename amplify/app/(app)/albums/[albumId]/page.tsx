import { notFound } from "next/navigation";
import { AlbumDetailPage } from "@/features/albums/components/AlbumDetailPage";
import { fetchAlbumById, fetchAlbumMediaPage } from "@/lib/album-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AlbumDetailRouteProps = {
  params: Promise<{ albumId: string }>;
};

export default async function AlbumDetailRoute({ params }: AlbumDetailRouteProps) {
  const { albumId } = await params;

  let album: Awaited<ReturnType<typeof fetchAlbumById>> = null;
  let initialItems: Awaited<ReturnType<typeof fetchAlbumMediaPage>>["items"] = [];
  let initialCursor: string | null = null;

  try {
    album = await fetchAlbumById(albumId);
    if (!album) {
      notFound();
    }

    const page = await fetchAlbumMediaPage({ albumId, limit: 100 });
    initialItems = page.items;
    initialCursor = page.nextCursor;
  } catch (error) {
    console.error("Album detail SSR load error:", error);
    notFound();
  }

  return <AlbumDetailPage album={album} initialItems={initialItems} initialCursor={initialCursor} />;
}
