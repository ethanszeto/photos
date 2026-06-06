import { AlbumsPage } from "@/features/albums/components/AlbumsPage";
import { fetchAlbumList } from "@/lib/album-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AlbumsRoute() {
  let albums: Awaited<ReturnType<typeof fetchAlbumList>> = [];

  try {
    albums = await fetchAlbumList();
  } catch (error) {
    console.error("Albums SSR load error:", error);
  }

  return <AlbumsPage initialAlbums={albums} />;
}
