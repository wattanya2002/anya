import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { allFields, isFileType } from "@/lib/forms-core";
import { publishedById } from "@/lib/forms-server";
import { resolveToken } from "@/lib/kol-intake";
import { clientIp, fileSha, hashClaim, ipHash, newClaim, rateLimit, sniffMime } from "@/lib/kol-security";

export const runtime = "nodejs";
const ABS_MAX = 10 * 1024 * 1024;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/** Public upload for a field of a published form. Returns an id + a one-time claim secret that the submission must present. */
export async function POST(req: Request) {
  const ip = ipHash(await clientIp());
  if (!(await rateLimit("upload", ip, 40, 600))) return bad("อัปโหลดถี่เกินไป กรุณารอสักครู่แล้วลองใหม่", 429);
  let fd: FormData;
  try { fd = await req.formData(); } catch { return bad("ไฟล์ใหญ่เกินไปหรือรูปแบบไม่ถูกต้อง"); }
  const formId = String(fd.get("form_id") ?? "");
  const fieldKey = String(fd.get("field") ?? "");
  const file = fd.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(formId) || !(file instanceof File)) return bad("ข้อมูลไม่ครบ");
  const form = await publishedById(formId);
  if (!form || form.status !== "published") return bad("แบบฟอร์มนี้ปิดรับข้อมูลแล้ว", 404);
  if (form.purpose === "kol_registration") {
    const who = await resolveToken(String(fd.get("token") ?? ""), "registration");
    if (!who || who.orgId !== form.orgId) return bad("ลิงก์หมดอายุ กรุณาขอลิงก์ใหม่จากทีมงาน", 403);
  }
  const field = allFields(form.schema).find((f) => f.key === fieldKey);
  if (!field || !isFileType(field.type)) return bad("ไม่พบช่องอัปโหลดนี้", 404);
  const maxBytes = Math.min(ABS_MAX, (field.validation?.maxSizeMb ?? 5) * 1024 * 1024);
  if (file.size <= 0) return bad("ไฟล์ว่างเปล่า");
  if (file.size > maxBytes) return bad(`ไฟล์ใหญ่เกิน ${field.validation?.maxSizeMb ?? 5} MB`);
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  const accept = field.type === "image" ? ["image"] : field.validation?.accept ?? ["image", "pdf"];
  const ok = mime && ((mime.startsWith("image/") && accept.includes("image")) || (mime === "application/pdf" && accept.includes("pdf")));
  if (!ok) return bad(field.type === "image" ? "รองรับเฉพาะรูป JPG, PNG หรือ WebP" : `รองรับเฉพาะ ${accept.map((a) => (a === "pdf" ? "PDF" : "รูปภาพ")).join(" หรือ ")}`);
  const name = (file.name || "file").replace(/[\u0000-\u001f\\/:*?"<>|]+/g, "_").slice(-120) || "file";
  const claim = newClaim();
  const { rows } = await db().query(
    `insert into form_files (org_id, form_id, field_key, file_name, mime, size_bytes, sha256, data, claim_hash, ip_hash)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
    [form.orgId, form.formId, field.key, name, mime, buf.length, fileSha(buf), buf, hashClaim(claim), ip]);
  // Abandoned uploads (never attached to a submission) are removed after 24 hours.
  if (Math.random() < 0.1) await db().query(`delete from form_files where submission_id is null and purpose = 'answer' and created_at < now() - interval '24 hours'`);
  return NextResponse.json({ id: rows[0].id, claim, name, size: buf.length, mime }, { headers: { "Cache-Control": "no-store" } });
}
