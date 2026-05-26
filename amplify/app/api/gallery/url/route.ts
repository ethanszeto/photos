import { NextResponse } from "next/server";
import { isAuthenticatedServer } from "@/lib/session";
import { createPresignedViewUrl, getPublicObjectUrl } from "@/lib/s3";

export async function GET(request: Request) {
  if (!(await isAuthenticatedServer())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key || !key.startsWith("originals/")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  try {
    const usePresigned = process.env.S3_USE_PRESIGNED_VIEW !== "false";
    const url = usePresigned ? await createPresignedViewUrl(key) : getPublicObjectUrl(key);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Gallery URL error:", error);
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }
}
