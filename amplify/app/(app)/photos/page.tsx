import { MediaGridPage } from "@/features/gallery/components/MediaGridPage";
import { fetchGalleryPage } from "@/lib/media-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PhotosPage() {
  let initialItems: Awaited<ReturnType<typeof fetchGalleryPage>>["items"] = [];
  let initialCursor: string | null = null;

  try {
    const page = await fetchGalleryPage({ limit: 100 });
    initialItems = page.items;
    initialCursor = page.nextCursor;
  } catch (error) {
    console.error("Photos SSR load error:", error);
  }

  return (
    <MediaGridPage
      title="Photos"
      initialItems={initialItems}
      initialCursor={initialCursor}
      apiPath="/api/gallery"
      refreshOnUpload
    />
  );
}
