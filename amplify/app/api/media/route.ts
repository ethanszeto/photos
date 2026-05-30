import { NextRequest, NextResponse } from "next/server";
import { fetchMediaPage } from "@/lib/media-server";
import { isAuthenticatedRequest } from "@/lib/session";
import type { MediaListResponse } from "@/types";

export async function GET(request: NextRequest): Promise<NextResponse<MediaListResponse | { error: string }>> {
  if (!(await isAuthenticatedRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  try {
    const page = await fetchMediaPage({ cursor, limit });
    return NextResponse.json(page);
  } catch (error) {
    console.error("Media list error:", error);
    return NextResponse.json({ error: "Failed to load media" }, { status: 500 });
  }
}
