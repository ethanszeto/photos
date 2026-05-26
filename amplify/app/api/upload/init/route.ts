import { NextResponse } from "next/server";
import { isAuthenticatedServer } from "@/lib/session";
import { createPresignedUpload, extensionFromContentType } from "@/lib/s3";

export async function POST(request: Request) {
  if (!(await isAuthenticatedServer())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { contentType?: string };
    const contentType = body.contentType?.trim() ?? "";

    if (!contentType || !extensionFromContentType(contentType)) {
      return NextResponse.json({ error: "Unsupported content type. Use JPEG, PNG, or HEIC." }, { status: 400 });
    }

    const result = await createPresignedUpload(contentType);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Upload init error:", error);
    return NextResponse.json({ error: "Failed to prepare upload" }, { status: 500 });
  }
}
