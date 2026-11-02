import Link from "next/link";
import { Plus, Truck, X } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { listSuppliers } from "@/lib/inventory";
import { ContactButtons } from "@/components/inventory/contact";
import { SupplierForm } from "@/components/inventory/supplier-form";

import { MobileTabs } from "@/components/mobile-tabs";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const manage = can(user, "inventory.manage");
  const suppliers = await listSuppliers(user.orgId);
  const editing = sp.edit ? suppliers.find((s) => s.id === sp.edit) ?? null : null;
  const panel = manage && (sp.new === "1" || editing);
  return (
    <div className={`inv-body inv-split${panel ? " has-panel" : ""}`} data-mscope="sup">
      {panel && <MobileTabs scope="sup" label="เลือกการ์ด" defaultTab={`form-${sp.edit ?? "new"}`} tabs={[
        { id: "list", label: "รายชื่อ" }, { id: `form-${sp.edit ?? "new"}`, label: editing ? "แก้ไข" : "เพิ่มซัพพลายเออร์" },
      ]} />}
      <article className="card panel" aria-labelledby="sup-title" data-tab="list">
        <div className="panel-head">
          <span className="badge-icon tone-green" aria-hidden="true"><Truck /></span>
          <div className="panel-head-text"><h2 className="panel-title" id="sup-title">ซัพพลายเออร์ <small>({suppliers.length})</small></h2>
            <p className="panel-sub">กด “โทร” หรือ “LINE” เพื่อติดต่อได้ทันที</p></div>
          {manage && <Link className="btn-pill primary" href="/inventory/suppliers?new=1"><Plus aria-hidden="true" />เพิ่ม</Link>}
        </div>
        <div className="card-body">
          {suppliers.length === 0 ? <div className="empty-state"><strong>ยังไม่มีซัพพลายเออร์</strong>{manage && <Link href="/inventory/suppliers?new=1">เพิ่มรายแรก</Link>}</div> : (
            <ul className="rows">
              {suppliers.map((s) => (
                <li key={s.id} className={`row${s.isActive ? "" : " inactive"}`}>
                  <div className="row-main">
                    <span className="row-title">{s.name}{s.isActive ? "" : " (ไม่ใช้งาน)"}</span>
                    <span className="row-sub">{[s.contactName, s.phone, s.leadTimeDays !== null ? `รอของ ~${s.leadTimeDays} วัน` : null, `${s.productCount} สินค้า`].filter(Boolean).join(" · ")}</span>
                    {s.note && <span className="row-sub">{s.note}</span>}
                  </div>
                  <div className="row-side">
                    <ContactButtons name={s.name} phone={s.phone} lineUrl={s.lineUrl} size="md" />
                    {manage && <Link className="mini-btn ghost" href={`/inventory/suppliers?edit=${s.id}`}>แก้ไข</Link>}
                    <Link className="mini-btn ghost" href={`/inventory/products?supplier=${s.id}`}>ดูสินค้า</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
      {panel && (
        <aside className="card panel side-panel" aria-labelledby="sup-form-title" data-tab={`form-${sp.edit ?? "new"}`}>
          <div className="panel-head">
            <div className="panel-head-text"><h2 className="panel-title" id="sup-form-title">{editing ? `แก้ไข: ${editing.name}` : "เพิ่มซัพพลายเออร์"}</h2></div>
            <Link className="more" href="/inventory/suppliers" aria-label="ปิด"><X aria-hidden="true" /></Link>
          </div>
          <div className="card-body"><SupplierForm supplier={editing} /></div>
        </aside>
      )}
    </div>
  );
}
