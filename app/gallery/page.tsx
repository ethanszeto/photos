import { GalleryView } from "@/components/gallery/GalleryView";
import { fetchGalleryPhotos } from "@/lib/gallery-server";

export default async function GalleryPage() {
  let initialPhotos: Awaited<ReturnType<typeof fetchGalleryPhotos>> = [];

  try {
    initialPhotos = await fetchGalleryPhotos();
  } catch (error) {
    console.error("Gallery SSR load error:", error);
  }

  return <GalleryView initialPhotos={initialPhotos} />;
}
