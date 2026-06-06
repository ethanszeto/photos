import { NextRequest, NextResponse } from "next/server";
import { fetchAlbumById, fetchAlbumMediaPage } from "@/lib/album-server";
import { NO_STORE_CACHE_CONTROL } from "@/shared/lib/no-store";
import { isAuthenticatedRequest } from "@/lib/session";
import type { MediaListResponse } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ albumId: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<MediaListResponse | { error: string }>> {
  if (!(await isAuthenticatedRequest(request))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
    );
  }

  const { albumId } = await context.params;

  if (!albumId) {
    return NextResponse.json(
      { error: "Album id is required" },
      { status: 400, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
    );
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  try {
    const album = await fetchAlbumById(albumId);
    if (!album) {
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
      );
    }

    const page = await fetchAlbumMediaPage({ albumId, cursor, limit });
    return NextResponse.json(page, { headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } });
  } catch (error) {
    console.error("Album media error:", error);
    return NextResponse.json(
      { error: "Failed to load album" },
      { status: 500, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
    );
  }
}
