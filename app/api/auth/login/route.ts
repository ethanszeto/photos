import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions, verifyPasscode } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { passcode?: string };
    const passcode = body.passcode?.trim() ?? "";

    if (!/^\d{6}$/.test(passcode)) {
      return NextResponse.json({ error: "Passcode must be 6 digits" }, { status: 400 });
    }

    if (!verifyPasscode(passcode)) {
      return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ ok: true });
    const cookie = sessionCookieOptions(token);
    response.cookies.set(cookie);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Authentication is not configured" }, { status: 500 });
  }
}
