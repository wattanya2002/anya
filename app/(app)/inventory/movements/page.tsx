import { ArrowLeftRight, History } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { getLocations, listMovements, listProducts } from "@/lib/inventory";
import { formatInt, formatThaiDateTime } from "@/lib/format";
import { MovementForm } from "@/components/inventory/movement-form";

export const dynamic = "force-dynamic";

export default async function MovementsPage({ searchParams }: { searchParams: Promise<{ product?: string; op?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [locations, products, moves] = await Promise.all([getLocations(user.orgId), listProducts(user.orgId), listMovements(user.orgId, { limit: 200 })]);
  return (
    <div className="inv-body inv-split has-panel panel-left">
      <article className="card panel side-panel" aria-labelledby="mv-title">
        <div className="panel-head">
          <span className="badge-icon tone-pink" aria-hidden="true"><ArrowLeftRight /></span>
          <div className="panel-head-text"><h2 className="panel-title" id="mv-title">บันทึกรับเข้า / เบิก / ย้าย</h2><p className="panel-sub">ทุกครั้งบันทึกชื่อผู้ทำและเวลา</p></div>
        </div>
        <div className="card-body">
          <MovementForm canManage={can(user, "inventory.manage")} defaultProductId={sp.product} defaultOp={sp.op}
            products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, unit: p.unit, byLocation: p.byLocation }))} locations={locations} />
        </div>
      </article>
      <article className="card panel" aria-labelledby="log-title">
        <div className="panel-head">
          <span className="badge-icon tone-purple" aria-hidden="true"><History /></span>
          <div className="panel-head-text"><h2 className="panel-title" id="log-title">ประวัติการเคลื่อนไหว <small>(ล่าสุด {moves.length} รายการ)</small></h2>
            <p className="panel-sub">ประวัติแก้ไขย้อนหลังไม่ได้ — ถ้าบันทึกผิดให้ทำรายการ “ปรับตามยอดนับจริง”</p></div>
        </div>
        <div className="card-body">
          {moves.length === 0 ? <div className="empty-state"><strong>ยังไม่มีการเคลื่อนไหว</strong></div> : (
            <table className="tbl">
              <thead><tr><th scope="col">สินค้า</th><th scope="col">เวลา</th><th scope="col">รายการ</th><th scope="col">ที่เก็บ</th><th scope="col" className="num">จำนวน</th><th scope="col" className="num">คงเหลือ</th><th scope="col">ผู้ทำ / หมายเหตุ</th></tr></thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id}>
                    <th scope="row"><span className="cell-title">{m.product}</span><span className="cell-sub">{m.sku}</span></th>
                    <td data-label="เวลา">{formatThaiDateTime(m.createdAt)}</td>
                    <td data-label="รายการ">{m.typeTh}</td>
                    <td data-label="ที่เก็บ">{m.location}</td>
                    <td className={`num qty ${m.qtyDelta > 0 ? "plus" : "minus"}`} data-label="จำนวน">{m.qtyDelta > 0 ? "+" : "−"}{formatInt(Math.abs(m.qtyDelta))}</td>
                    <td className="num" data-label="คงเหลือ">{formatInt(m.balanceAfter)}</td>
                    <td data-label="ผู้ทำ / หมายเหตุ"><span className="cell-title">{m.actor ?? "ระบบ"}</span><span className="cell-sub">{[m.reference, m.note].filter(Boolean).join(" · ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </article>
    </div>
  );
}
