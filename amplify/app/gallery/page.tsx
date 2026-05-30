import { GalleryPage } from "@/components/gallery/GalleryPage";
import { fetchMediaPage } from "@/lib/media-server";

/** Always read Dynamo at request time — never bake the gallery list into the deploy artifact. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
