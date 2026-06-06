import { NextRequest, NextResponse } from "next/server";
import { fetchLatestTakenAt } from "@/lib/media-server";
import { NO_STORE_CACHE_CONTROL } from "@/shared/lib/no-store";
import { isAuthenticatedRequest } from "@/lib/session";
import type { LatestMediaResponse } from "@/types";

export const dynamic = "force-dynamic";

const jsonHeaders = { "Cache-Control": NO_STORE_CACHE_CONTROL };

export async function GET(request: NextRequest): Promise<NextResponse<LatestMediaResponse | { error: string }>> {
  if (!(await isAuthenticatedRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: jsonHeaders });
  }

  try {
    const latestTakenAt = await fetchLatestTakenAt();
    return NextResponse.json({ latestTakenAt } satisfies LatestMediaResponse, { headers: jsonHeaders });
  } catch (error) {
    console.error("Latest gallery error:", error);
    return NextResponse.json({ error: "Failed to load latest media date" }, { status: 500, headers: jsonHeaders });
  }
}
