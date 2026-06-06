import { NextRequest, NextResponse } from "next/server";
import { fetchAlbumList } from "@/lib/album-server";
import { NO_STORE_CACHE_CONTROL } from "@/shared/lib/no-store";
import { isAuthenticatedRequest } from "@/lib/session";
import type { AlbumListResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse<AlbumListResponse | { error: string }>> {
  if (!(await isAuthenticatedRequest(request))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
    );
  }

  try {
    const albums = await fetchAlbumList();
    return NextResponse.json({ albums }, { headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } });
  } catch (error) {
    console.error("Album list error:", error);
    return NextResponse.json(
      { error: "Failed to load albums" },
      { status: 500, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
    );
  }
}
