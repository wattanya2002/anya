import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import type { PoolClient } from "pg";
import { db } from "./db";

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
export const hashToken = (token: string) => sha256(`kol-token:${token}`);

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return s;
}
const encKey = () => createHash("sha256").update(`kol-token-enc-v1:${secret()}`).digest();

/** 32 random bytes, base64url (43 chars). */
export const newToken = () => randomBytes(32).toString("base64url");
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([c.update(token, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}
export function decryptToken(enc: string | null): string | null {
  if (!enc) return null;
  try {
    const b = Buffer.from(enc, "base64url");
    const d = createDecipheriv("aes-256-gcm", encKey(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
  } catch { return null; }
}

/** Short random secret proving the uploader owns an orphan file (only its hash is stored). */
export const newClaim = () => randomBytes(18).toString("base64url");
export const hashClaim = (claim: string) => sha256(`claim:${claim}`);
export function claimMatches(claim: string, hash: string | null): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashClaim(claim), "hex"), b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}
/** IP is never stored in clear: a keyed hash is enough for rate limiting and abuse review. */
export const ipHash = (ip: string) => sha256(`ip:${secret()}:${ip}`).slice(0, 32);

/** Sliding-window limiter on Postgres (works across serverless instances). Returns false when the caller is over the limit. */
export async function rateLimit(bucket: string, key: string, max: number, windowSec: number, c?: PoolClient): Promise<boolean> {
  const q = c ?? db();
  const { rows } = await q.query(
    `select count(*)::int as n from public_rate_events where bucket = $1 and key_hash = $2 and created_at > now() - make_interval(secs => $3)`,
    [bucket, key, windowSec]);
  if (rows[0].n >= max) return false;
  await q.query(`insert into public_rate_events (bucket, key_hash) values ($1, $2)`, [bucket, key]);
  if (Math.random() < 0.02) await q.query(`delete from public_rate_events where created_at < now() - interval '2 days'`);
  return true;
}

/** Detects the real file type from its first bytes (the browser-supplied type is not trusted). */
export function sniffMime(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}
export const fileSha = (buf: Buffer) => sha256(buf);
