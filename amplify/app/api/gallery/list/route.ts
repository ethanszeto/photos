import { NextResponse } from "next/server";
import { fetchGalleryPhotos } from "@/lib/gallery-server";
import { isAuthenticatedServer } from "@/lib/session";
import type { GalleryListResponse } from "@/types";

export async function GET() {
  if (!(await isAuthenticatedServer())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const photos = await fetchGalleryPhotos();

    return NextResponse.json({ photos } satisfies GalleryListResponse);
  } catch (error) {
    console.error("Gallery list error:", error);
    return NextResponse.json({ error: "Failed to load gallery" }, { status: 500 });
  }
}
