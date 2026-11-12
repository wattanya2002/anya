import { db } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";

export const runtime = "nodejs";

/** Applicant uploads: signed-in team members of the same organization only. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!can(user, "kol.view") && !can(user, "forms.responses")) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const { rows } = await db().query(`select file_name, mime, data from form_files where id = $1 and org_id = $2`, [id, user.orgId]);
  const r = rows[0];
  if (!r) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  const disp = `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(r.file_name)}`;
  return new Response(new Uint8Array(r.data), {
    headers: {
      "Content-Type": r.mime, "Content-Disposition": disp, "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
