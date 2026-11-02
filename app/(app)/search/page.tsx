import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { NAV } from "@/lib/nav";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const menus = q ? Object.values(NAV).filter((n) => `${n.label} ${n.sub}`.toLowerCase().includes(q.toLowerCase())) : [];
  const rows = q
    ? (
        await db().query(
          `select 'งาน' as kind, title as name, '/' as href from tasks where org_id = $1 and title ilike $2
           union all select 'แคมเปญ', name, '${NAV.marketing.href}' from campaigns where org_id = $1 and name ilike $2
           union all select 'โปรโมชั่น', name, '${NAV.promotion.href}' from promotions where org_id = $1 and (name ilike $2 or code ilike $2)
           limit 30`,
          [user.orgId, like],
        )
      ).rows
    : [];
  return (
    <section className="card page" aria-labelledby="search-title">
      <h1 id="search-title">ผลการค้นหา</h1>
      {!q ? <p>พิมพ์คำค้นในช่องค้นหาด้านบน</p> : <p>คำค้น “{q}” · พบ {menus.length + rows.length} รายการ</p>}
      <ul className="result-list">
        {menus.map((m) => <li key={m.key}><Link href={m.href}><b>เมนู:</b> {m.label} · {m.sub}</Link></li>)}
        {rows.map((r, i) => <li key={i}><Link href={r.href}><b>{r.kind}:</b> {r.name}</Link></li>)}
      </ul>
    </section>
  );
}
