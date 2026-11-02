import Link from "next/link";
import { AlertTriangle, Boxes, Coins, History, PackageX, PieChart, Plus, Upload, FileText, ArrowLeftRight } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { inventoryOverview, suggestedOrderQty } from "@/lib/inventory";
import { formatBahtFromSatang, formatInt, formatThaiDateTime } from "@/lib/format";
import { ContactButtons } from "@/components/inventory/contact";
import { StockBadge } from "@/components/inventory/status";

export const dynamic = "force-dynamic";

export default async function InventoryOverview() {
  const user = await requireUser();
  const o = await inventoryOverview(user.orgId);
  const manage = can(user, "inventory.manage");
  return (
    <div className="inv-body inv-overview">
      <div className="inv-actions">
        {manage && <Link className="btn-pill primary" href="/inventory/products?new=1"><Plus aria-hidden="true" />เพิ่มสินค้า</Link>}
        {manage && <Link className="btn-pill" href="/inventory/movements"><ArrowLeftRight aria-hidden="true" />รับเข้า / เบิก</Link>}
        {manage && <Link className="btn-pill" href="/inventory/import"><Upload aria-hidden="true" />นำเข้าไฟล์</Link>}
        <Link className="btn-pill" href="/inventory/report"><FileText aria-hidden="true" />สรุปส่งหัวหน้า</Link>
      </div>
      <section className="kpis inv-kpis" aria-label="ตัวชี้วัดสต็อก">
        <Kpi icon={<Boxes />} tone="tone-blue" label="สินค้าที่ใช้งาน" value={formatInt(o.productCount)} sub="รายการ" />
        <Kpi icon={<Coins />} tone="tone-green" label="มูลค่าสต็อก (ราคาทุน)" value={formatBahtFromSatang(o.valueSatang)} sub="ทุกที่เก็บรวมกัน" />
        <Kpi icon={<AlertTriangle />} tone="tone-amber" label="ใกล้หมด" value={formatInt(o.lowCount)} sub="ถึงจุดสั่งซื้อแล้ว" href="/inventory/products?status=low" />
        <Kpi icon={<PackageX />} tone="tone-pink" label="หมดสต็อก" value={formatInt(o.outCount)} sub="คงเหลือ 0" href="/inventory/products?status=out" />
      </section>

      <article className="card panel inv-att" aria-labelledby="att-title">
        <div className="panel-head">
          <span className="badge-icon tone-amber" aria-hidden="true"><AlertTriangle /></span>
          <div className="panel-head-text"><h2 className="panel-title" id="att-title">ต้องสั่งเพิ่ม <small>({o.attention.length} รายการ)</small></h2>
            <p className="panel-sub">กดโทรหรือ LINE หาซัพพลายเออร์ได้ทันที</p></div>
        </div>
        <div className="card-body">
          {o.attention.length === 0 ? (
            <div className="empty-state"><strong>ยังไม่มีสินค้าที่ต้องสั่ง</strong><span>สินค้าจะขึ้นที่นี่เมื่อคงเหลือถึง “จุดสั่งซื้อ” ที่ตั้งไว้</span></div>
          ) : (
            <ul className="rows">
              {o.attention.map((p) => (
                <li key={p.id} className="row">
                  <div className="row-main">
                    <Link href={`/inventory/products?edit=${p.id}`} className="row-title">{p.name}</Link>
                    <span className="row-sub">{[p.brand, p.category].filter(Boolean).join(" · ") || p.sku} · คงเหลือ <b>{formatInt(p.total)}</b> {p.unit} · แนะนำสั่ง <b>{formatInt(suggestedOrderQty(p))}</b> {p.unit}</span>
                    <span className="row-sub">{p.supplier ?? "ยังไม่ระบุซัพพลายเออร์"}</span>
                  </div>
                  <div className="row-side">
                    <StockBadge status={p.status} />
                    {p.supplier && <ContactButtons name={p.supplier} phone={p.supplierPhone} lineUrl={p.supplierLine} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>

      <article className="card panel inv-rec" aria-labelledby="rec-title">
        <div className="panel-head">
          <span className="badge-icon tone-purple" aria-hidden="true"><History /></span>
          <div className="panel-head-text"><h2 className="panel-title" id="rec-title">เคลื่อนไหวล่าสุด</h2><p className="panel-sub">รับเข้า เบิก ขาย ย้าย ปรับยอด</p></div>
          <Link className="link-btn small" href="/inventory/movements">ดูทั้งหมด</Link>
        </div>
        <div className="card-body">
          {o.recent.length === 0 ? <div className="empty-state"><strong>ยังไม่มีการเคลื่อนไหว</strong></div> : (
            <ul className="rows">
              {o.recent.map((m) => (
                <li key={m.id} className="row">
                  <div className="row-main">
                    <span className="row-title">{m.product}</span>
                    <span className="row-sub">{m.typeTh} · {m.location} · {formatThaiDateTime(m.createdAt)}{m.actor ? ` · ${m.actor}` : ""}</span>
                  </div>
                  <span className={`qty ${m.qtyDelta > 0 ? "plus" : "minus"}`}>{m.qtyDelta > 0 ? "+" : "−"}{formatInt(Math.abs(m.qtyDelta))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>

      <article className="card panel inv-cat" aria-labelledby="cat-title">
        <div className="panel-head">
          <span className="badge-icon tone-green" aria-hidden="true"><PieChart /></span>
          <div className="panel-head-text"><h2 className="panel-title" id="cat-title">สต็อกตามประเภท</h2></div>
        </div>
        <div className="card-body">
          {o.byCategory.length === 0 ? <div className="empty-state"><strong>ยังไม่มีสินค้า</strong>{manage && <Link href="/inventory/products?new=1">เพิ่มสินค้าแรก</Link>}</div> : (
            <table className="tbl">
              <thead><tr><th scope="col">ประเภท</th><th scope="col" className="num">รายการ</th><th scope="col" className="num">จำนวน</th><th scope="col" className="num">มูลค่า</th></tr></thead>
              <tbody>
                {o.byCategory.map((c) => (
                  <tr key={c.name}><th scope="row">{c.name}</th><td className="num" data-label="รายการ">{formatInt(c.items)}</td><td className="num" data-label="จำนวน">{formatInt(c.qty)}</td><td className="num" data-label="มูลค่า">{formatBahtFromSatang(c.valueSatang)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </article>
    </div>
  );
}

function Kpi({ icon, tone, label, value, sub, href }: { icon: React.ReactNode; tone: string; label: string; value: string; sub: string; href?: string }) {
  const body = (
    <>
      <span className={`badge-icon ${tone}`} aria-hidden="true">{icon}</span>
      <div className="kpi-body"><div className="kpi-label">{label}</div><div className="kpi-line"><span className="kpi-value">{value}</span></div><div className="kpi-sub">{sub}</div></div>
    </>
  );
  return href ? <Link href={href} className="card kpi kpi-link">{body}</Link> : <article className="card kpi">{body}</article>;
}
