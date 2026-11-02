import Link from "next/link";
import { Package, Plus, Search, X } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { getLocations, getLookups, listProducts } from "@/lib/inventory";
import { formatBahtExact, formatInt } from "@/lib/format";
import { ProductForm } from "@/components/inventory/product-form";
import { MovementForm } from "@/components/inventory/movement-form";
import { StockBadge } from "@/components/inventory/status";
import { ContactButtons } from "@/components/inventory/contact";

export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const manage = can(user, "inventory.manage");
  const [locations, lookups, products, all] = await Promise.all([
    getLocations(user.orgId), getLookups(user.orgId),
    listProducts(user.orgId, { q: sp.q?.slice(0, 80), category: sp.category, brand: sp.brand, supplier: sp.supplier, status: sp.status, includeInactive: sp.inactive === "1" }),
    listProducts(user.orgId, { includeInactive: true }),
  ]);
  const editing = sp.edit ? all.find((p) => p.id === sp.edit) ?? null : null;
  const adjust = sp.adjust ? all.find((p) => p.id === sp.adjust) ?? null : null;
  const panel = manage && (sp.new === "1" || editing || adjust);
  const keep = (extra: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, category: sp.category, brand: sp.brand, status: sp.status, inactive: sp.inactive }).filter(([, v]) => v) as [string, string][]);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/inventory/products?${p.toString()}`;
  };
  const closeHref = keep({});

  return (
    <div className={`inv-body inv-split${panel ? " has-panel" : ""}`}>
      <article className="card panel" aria-labelledby="prod-title">
        <div className="panel-head">
          <span className="badge-icon tone-blue" aria-hidden="true"><Package /></span>
          <div className="panel-head-text"><h2 className="panel-title" id="prod-title">สินค้า <small>({products.length} รายการ)</small></h2></div>
          {manage && <Link className="btn-pill primary" href={keep({ new: "1" })}><Plus aria-hidden="true" />เพิ่มสินค้า</Link>}
        </div>
        <form className="filters" action="/inventory/products" role="search">
          <div className="field grow"><label htmlFor="f-q" className="sr-only">ค้นหา</label>
            <span className="input-icon"><Search aria-hidden="true" /><input id="f-q" name="q" type="search" placeholder="ค้นหาชื่อ / SKU / บาร์โค้ด / ยี่ห้อ" defaultValue={sp.q} /></span></div>
          <div className="field"><label htmlFor="f-cat" className="sr-only">ประเภท</label>
            <select id="f-cat" name="category" defaultValue={sp.category ?? ""}><option value="">ทุกประเภท</option>{lookups.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field"><label htmlFor="f-brand" className="sr-only">ยี่ห้อ</label>
            <select id="f-brand" name="brand" defaultValue={sp.brand ?? ""}><option value="">ทุกยี่ห้อ</option>{lookups.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div className="field"><label htmlFor="f-status" className="sr-only">สถานะ</label>
            <select id="f-status" name="status" defaultValue={sp.status ?? ""}><option value="">ทุกสถานะ</option><option value="attention">ต้องสั่ง (ใกล้หมด+หมด)</option><option value="low">ใกล้หมด</option><option value="out">หมด</option></select></div>
          <label className="check"><input type="checkbox" name="inactive" value="1" defaultChecked={sp.inactive === "1"} /> รวมที่เลิกใช้</label>
          <button className="btn-pill" type="submit">กรอง</button>
        </form>
        <div className="card-body">
          {products.length === 0 ? (
            <div className="empty-state"><strong>{all.length ? "ไม่พบสินค้าตามเงื่อนไข" : "ยังไม่มีสินค้า"}</strong>
              {manage && !all.length && <span><Link href={keep({ new: "1" })}>เพิ่มทีละรายการ</Link> หรือ <Link href="/inventory/import">นำเข้าจากไฟล์ Excel</Link></span>}</div>
          ) : (
            <table className="tbl tbl-wide tbl-products">
              <thead><tr>
                <th scope="col">สินค้า</th><th scope="col">ประเภท / ยี่ห้อ</th>
                {locations.map((l) => <th key={l.id} scope="col" className="num">{l.name}</th>)}
                <th scope="col" className="num">รวม</th><th scope="col">สถานะ</th><th scope="col" className="num">ทุน/หน่วย</th><th scope="col"><span className="sr-only">จัดการ</span></th>
              </tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className={p.isActive ? "" : "inactive"}>
                    <th scope="row"><span className="cell-title">{p.name}</span><span className="cell-sub">{p.sku}{p.isActive ? "" : " · เลิกใช้"}</span></th>
                    <td data-label="ประเภท / ยี่ห้อ"><span className="cell-title">{p.category ?? "—"}</span><span className="cell-sub">{p.brand ?? ""}</span></td>
                    {locations.map((l) => <td key={l.id} className="num" data-label={l.name}>{formatInt(p.byLocation[l.id] ?? 0)}</td>)}
                    <td className="num strong" data-label="รวม">{formatInt(p.total)} <span className="cell-sub inline">{p.unit}</span></td>
                    <td data-label="สถานะ"><StockBadge status={p.status} /></td>
                    <td className="num" data-label="ทุน/หน่วย">{formatBahtExact(p.costSatang)}</td>
                    <td className="actions">
                      {manage && <Link className="mini-btn" href={keep({ adjust: p.id })}>+/− สต็อก</Link>}
                      {manage && <Link className="mini-btn ghost" href={keep({ edit: p.id })}>แก้ไข</Link>}
                      {p.supplier && <ContactButtons name={p.supplier} phone={p.supplierPhone} lineUrl={p.supplierLine} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </article>

      {panel && (
        <aside className="card panel side-panel" aria-labelledby="side-title">
          <div className="panel-head">
            <div className="panel-head-text"><h2 className="panel-title" id="side-title">{adjust ? `ปรับสต็อก: ${adjust.name}` : editing ? `แก้ไข: ${editing.name}` : "เพิ่มสินค้าใหม่"}</h2></div>
            <Link className="more" href={closeHref} aria-label="ปิด"><X aria-hidden="true" /></Link>
          </div>
          <div className="card-body">
            {adjust ? (
              <MovementForm canManage={manage} defaultProductId={adjust.id}
                products={all.filter((p) => p.isActive || p.id === adjust.id).map((p) => ({ id: p.id, name: p.name, sku: p.sku, unit: p.unit, byLocation: p.byLocation }))}
                locations={locations} />
            ) : (
              <ProductForm product={editing} categories={lookups.categories} brands={lookups.brands} suppliers={lookups.suppliers} locations={locations} />
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
