import { NextRequest, NextResponse } from "next/server";
import { fetchGalleryPage } from "@/lib/media-server";
import { NO_STORE_CACHE_CONTROL } from "@/lib/no-store";
import { isAuthenticatedRequest } from "@/lib/session";
import type { MediaListResponse } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ year: string }>;
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

  const { year: yearParam } = await context.params;
  const year = Number.parseInt(yearParam, 10);

  if (!Number.isFinite(year) || year < 1970 || year > 2100) {
    return NextResponse.json(
      { error: "Invalid year" },
      { status: 400, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
    );
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  try {
    const page = await fetchGalleryPage({ cursor, limit, year });
    return NextResponse.json(page, { headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } });
  } catch (error) {
    console.error("Gallery year list error:", error);
    return NextResponse.json(
      { error: "Failed to load gallery for year" },
      { status: 500, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
    );
  }
}
