import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { fileSha, sniffMime } from "@/lib/kol-security";

export const runtime = "nodejs";

/** Cover image for a form (Form Builder → ตั้งค่า). The editor stores the returned id in the draft settings. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!can(user, "forms.manage")) return NextResponse.json({ error: "บัญชีนี้ไม่มีสิทธิ์แก้ไขฟอร์ม" }, { status: 403 });
  const { id } = await ctx.params;
  const form = /^[0-9a-f-]{36}$/i.test(id) ? (await db().query(`select id from forms where id = $1 and org_id = $2`, [id, user.orgId])).rows[0] : null;
  if (!form) return NextResponse.json({ error: "ไม่พบฟอร์ม" }, { status: 404 });
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File) || file.size <= 0) return NextResponse.json({ error: "เลือกรูปก่อนอัปโหลด" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "รูปใหญ่เกิน 8 MB" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime || !mime.startsWith("image/")) return NextResponse.json({ error: "รองรับเฉพาะรูป JPG, PNG หรือ WebP" }, { status: 400 });
  const { rows } = await db().query(
    `insert into form_files (org_id, form_id, field_key, purpose, file_name, mime, size_bytes, sha256, data, created_by, attached_at)
     values ($1,$2,'hero','hero',$3,$4,$5,$6,$7,$8, now()) returning id`,
    [user.orgId, id, (file.name || "cover").slice(-120), mime, buf.length, fileSha(buf), buf, user.id]);
  return NextResponse.json({ id: rows[0].id });
}
