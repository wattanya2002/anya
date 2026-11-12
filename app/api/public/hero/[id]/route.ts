import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Cover images chosen in the Form Builder are public by design (shown on the public form). Nothing else is served here. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const { rows } = await db().query(`select mime, data, sha256 from form_files where id = $1 and purpose = 'hero'`, [id]);
  const r = rows[0];
  if (!r) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(r.data), {
    headers: { "Content-Type": r.mime, "Cache-Control": "public, max-age=86400, immutable", ETag: `"${r.sha256.slice(0, 32)}"`, "X-Content-Type-Options": "nosniff" },
  });
}
