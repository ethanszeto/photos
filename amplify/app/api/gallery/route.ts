import { NextRequest, NextResponse } from "next/server";
import { fetchGalleryPage } from "@/lib/media-server";
import { NO_STORE_CACHE_CONTROL } from "@/shared/lib/no-store";
import { isAuthenticatedRequest } from "@/lib/session";
import type { MediaListResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse<MediaListResponse | { error: string }>> {
  if (!(await isAuthenticatedRequest(request))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
    );
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  try {
    const page = await fetchGalleryPage({ cursor, limit });
    return NextResponse.json(page, { headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } });
  } catch (error) {
    console.error("Gallery list error:", error);
    return NextResponse.json(
      { error: "Failed to load gallery" },
      { status: 500, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
    );
  }
}
