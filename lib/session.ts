import "server-only";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = { userId?: string; sessionVersion?: number };

function options(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return {
    password,
    cookieName: "wc_session",
    ttl: 60 * 60 * 8,
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), options());
}
