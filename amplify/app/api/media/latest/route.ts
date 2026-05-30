import { NextRequest, NextResponse } from "next/server";
import { fetchLatestTakenAt } from "@/lib/media-server";
import { isAuthenticatedRequest } from "@/lib/session";
import type { LatestMediaResponse } from "@/types";

export async function GET(request: NextRequest): Promise<NextResponse<LatestMediaResponse | { error: string }>> {
  if (!(await isAuthenticatedRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const latestTakenAt = await fetchLatestTakenAt();
    return NextResponse.json({ latestTakenAt } satisfies LatestMediaResponse);
  } catch (error) {
    console.error("Latest media error:", error);
    return NextResponse.json({ error: "Failed to load latest media date" }, { status: 500 });
  }
}
