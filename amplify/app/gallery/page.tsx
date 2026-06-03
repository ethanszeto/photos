import { GalleryPage } from "@/components/gallery/GalleryPage";
import { fetchGalleryPage } from "@/lib/media-server";

/** Always read Dynamo at request time — never bake the gallery list into the deploy artifact. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GalleryRoute() {
  let initialItems: Awaited<ReturnType<typeof fetchGalleryPage>>["items"] = [];
  let initialCursor: string | null = null;

  try {
    const page = await fetchGalleryPage({ limit: 100 });
    initialItems = page.items;
    initialCursor = page.nextCursor;
  } catch (error) {
    console.error("Gallery SSR load error:", error);
  }

  return <GalleryPage initialItems={initialItems} initialCursor={initialCursor} />;
}
