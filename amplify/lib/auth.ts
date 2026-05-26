import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "photo_vault_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? process.env.PHOTO_APP_PASSCODE ?? "";
  if (!secret) {
    throw new Error("SESSION_SECRET or PHOTO_APP_PASSCODE must be set");
  }
  return new TextEncoder().encode(secret);
}

function getPasscode(): string {
  const passcode = process.env.PHOTO_APP_PASSCODE;
  if (!passcode || passcode.length !== 6 || !/^\d{6}$/.test(passcode)) {
    throw new Error("PHOTO_APP_PASSCODE must be a 6-digit string");
  }
  return passcode;
}

export function verifyPasscode(input: string): boolean {
  try {
    return input === getPasscode();
  } catch {
    return false;
  }
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return payload.authenticated === true;
  } catch {
    return false;
  }
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
