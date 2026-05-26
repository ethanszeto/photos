import { NextResponse } from "next/server";
import { isAuthenticatedServer } from "@/lib/session";

export async function GET() {
  const authenticated = await isAuthenticatedServer();
  return NextResponse.json({ authenticated });
}
