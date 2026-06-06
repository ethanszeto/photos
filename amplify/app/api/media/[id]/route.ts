import { NextRequest, NextResponse } from "next/server";
import { fetchMediaById } from "@/lib/media-server";
import { NO_STORE_CACHE_CONTROL } from "@/shared/lib/no-store";
import { isAuthenticatedRequest } from "@/lib/session";
import type { MediaDetail } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<MediaDetail | { error: string }>> {
  if (!(await isAuthenticatedRequest(request))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
    );
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { error: "Missing media id" },
      { status: 400, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
    );
  }

  try {
    const media = await fetchMediaById(id);

    if (!media) {
      return NextResponse.json(
        { error: "Media not found" },
        { status: 404, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
      );
    }

    return NextResponse.json(media, { headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } });
  } catch (error) {
    console.error("Media detail error:", error);
    return NextResponse.json(
      { error: "Failed to load media" },
      { status: 500, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
    );
  }
}
