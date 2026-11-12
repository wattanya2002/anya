"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { clientIp, ipHash, rateLimit } from "@/lib/kol-security";
import { IntakeError, submitPublicForm, submitRegistration } from "@/lib/kol-intake";

export type PublicState = {
  error?: string; errors?: Record<string, string>; reload?: boolean;
  done?: { ref: string; statusUrl: string | null; title: string; message: string };
};

/** Signed render timestamp: submissions faster than a human can type are treated as automated. */
function sign(ts: string) {
  return createHmac("sha256", `form-start:${process.env.SESSION_SECRET ?? ""}`).update(ts).digest("base64url").slice(0, 22);
}
export async function startStamp(): Promise<string> {
  const ts = String(Date.now());
  return `${ts}.${sign(ts)}`;
}
function stampAgeMs(stamp: string): number | null {
  const [ts, sig] = stamp.split(".");
  if (!ts || !sig || !/^\d{13}$/.test(ts)) return null;
  const a = Buffer.from(sign(ts)), b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Date.now() - Number(ts);
}

async function meta() {
  const h = await headers();
  return { ipHash: ipHash(await clientIp()), userAgent: (h.get("user-agent") ?? "").slice(0, 400) || null };
}
async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function readCommon(fd: FormData) {
  const clientKey = String(fd.get("client_key") ?? "");
  let raw: Record<string, unknown> = {};
  try { raw = JSON.parse(String(fd.get("answers") ?? "{}")); } catch { raw = {}; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
  return { clientKey, raw, versionId: String(fd.get("version_id") ?? ""), honeypot: String(fd.get("website") ?? ""), stamp: String(fd.get("stamp") ?? "") };
}

function fail(err: unknown): PublicState {
  if (err instanceof IntakeError) {
    const errors = { ...(err.fields ?? {}) };
    const reload = !!errors.$reload;
    delete errors.$reload;
    return { error: err.message, errors, reload };
  }
  console.error("public form submit failed", err);
  return { error: "ส่งข้อมูลไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง" };
}

export async function submitPublic(_prev: PublicState, fd: FormData): Promise<PublicState> {
  const c = readCommon(fd);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(c.clientKey)) return { error: "กรุณารีเฟรชหน้าแล้วลองใหม่" };
  const age = stampAgeMs(c.stamp);
  if (c.honeypot || age === null || age < 2500) return { error: "ระบบไม่สามารถยืนยันการส่งได้ กรุณารอสักครู่แล้วกดส่งอีกครั้ง" };
  const m = await meta();
  if (!(await rateLimit("form_submit", m.ipHash, 8, 600))) return { error: "ส่งข้อมูลถี่เกินไป กรุณารอ 10 นาทีแล้วลองใหม่" };
  try {
    const r = await submitPublicForm({ slug: String(fd.get("slug") ?? ""), versionId: c.versionId, termsId: String(fd.get("terms_id") ?? "") || null,
      clientKey: c.clientKey, raw: c.raw, meta: m, baseUrl: await baseUrl() });
    return { done: { ref: r.ref, statusUrl: r.statusUrl, title: r.successTitle, message: r.successMessage } };
  } catch (err) { return fail(err); }
}

export async function submitStep2(_prev: PublicState, fd: FormData): Promise<PublicState> {
  const c = readCommon(fd);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(c.clientKey)) return { error: "กรุณารีเฟรชหน้าแล้วลองใหม่" };
  const m = await meta();
  if (!(await rateLimit("reg_submit", m.ipHash, 10, 600))) return { error: "ส่งข้อมูลถี่เกินไป กรุณารอ 10 นาทีแล้วลองใหม่" };
  try {
    const r = await submitRegistration({ token: String(fd.get("token") ?? ""), versionId: c.versionId, clientKey: c.clientKey, raw: c.raw, meta: m });
    return { done: { ref: r.ref, statusUrl: null, title: r.title, message: r.message } };
  } catch (err) { return fail(err); }
}
