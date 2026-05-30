import { GalleryPage } from "@/components/gallery/GalleryPage";
import { fetchMediaPage } from "@/lib/media-server";

export default async function GalleryRoute() {
  let initialItems: Awaited<ReturnType<typeof fetchMediaPage>>["items"] = [];
  let initialCursor: string | null = null;

  try {
    const page = await fetchMediaPage({ limit: 100 });
    initialItems = page.items;
    initialCursor = page.nextCursor;
  } catch (error) {
    console.error("Gallery SSR load error:", error);
  }

  return <GalleryPage initialItems={initialItems} initialCursor={initialCursor} />;
}
