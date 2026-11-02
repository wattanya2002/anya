import { FileText, ClipboardList } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { inventoryReport, reportText, suggestedOrderQty } from "@/lib/inventory";
import { reportRange } from "@/lib/report-range";
import { formatBahtFromSatang, formatInt } from "@/lib/format";
import { ReportActions } from "@/components/inventory/report-actions";
import { StockBadge } from "@/components/inventory/status";
import { MobileTabs } from "@/components/mobile-tabs";

export const dynamic = "force-dynamic";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; preset?: string }> }) {
  const user = await requireUser();
  const range = reportRange(await searchParams);
  const r = await inventoryReport(user.orgId, range.from, range.to);
  const text = reportText(r, user.orgName, new Date());
  const exportHref = `/inventory/report/export?from=${range.from}&to=${range.to}`;
  return (
    <div className="inv-body inv-report" data-mscope="rep">
      <MobileTabs scope="rep" label="เลือกการ์ด" tabs={[{ id: "main", label: "สรุปรายงาน" }, { id: "text", label: "ข้อความส่งหัวหน้า" }]} />
      <article className="card panel report-main" aria-labelledby="rp-title" data-tab="main">
        <div className="panel-head">
          <span className="badge-icon tone-pink" aria-hidden="true"><FileText /></span>
          <div className="panel-head-text"><h2 className="panel-title" id="rp-title">สรุปสต็อกส่งหัวหน้า</h2><p className="panel-sub">{user.orgName} · {range.from} ถึง {range.to}</p></div>
        </div>
        <form className="filters no-print" action="/inventory/report">
          <div className="field"><label htmlFor="r-preset" className="sr-only">ช่วงเวลา</label>
            <select id="r-preset" name="preset" defaultValue={range.preset === "custom" ? "" : range.preset}>
              <option value="7">7 วันล่าสุด</option><option value="30">30 วันล่าสุด</option><option value="month">เดือนนี้</option><option value="lastmonth">เดือนที่แล้ว</option><option value="">กำหนดเอง ↓</option>
            </select></div>
          <div className="field"><label htmlFor="r-from">จาก</label><input id="r-from" name="from" type="date" defaultValue={range.preset === "custom" ? range.from : ""} /></div>
          <div className="field"><label htmlFor="r-to">ถึง</label><input id="r-to" name="to" type="date" defaultValue={range.preset === "custom" ? range.to : ""} /></div>
          <button className="btn-pill" type="submit">แสดง</button>
        </form>
        <div className="card-body print-area">
          <div className="report-kpis">
            <div><span>สินค้าทั้งหมด</span><b>{formatInt(r.products.length)}</b></div>
            <div><span>มูลค่าคงเหลือ (ทุน)</span><b>{formatBahtFromSatang(r.valueSatang)}</b></div>
            <div><span>ใกล้หมด</span><b>{r.attention.filter((p) => p.status === "low").length}</b></div>
            <div><span>หมด</span><b>{r.attention.filter((p) => p.status === "out").length}</b></div>
          </div>
          <h3 className="mini-title">การเคลื่อนไหวในช่วงนี้</h3>
          {r.types.length === 0 ? <p className="muted">ไม่มีการเคลื่อนไหว</p> : (
            <table className="tbl"><thead><tr><th scope="col">รายการ</th><th scope="col" className="num">ครั้ง</th><th scope="col" className="num">จำนวน</th><th scope="col" className="num">มูลค่า (ทุน)</th></tr></thead>
              <tbody>{r.types.map((t) => <tr key={t.type}><th scope="row">{t.typeTh}</th><td className="num" data-label="ครั้ง">{t.count}</td><td className="num" data-label="จำนวน">{formatInt(t.qty)}</td><td className="num" data-label="มูลค่า">{formatBahtFromSatang(t.valueSatang)}</td></tr>)}</tbody></table>
          )}
          {r.topOut.length > 0 && (<>
            <h3 className="mini-title">ใช้ / ขายมากที่สุด</h3>
            <table className="tbl"><thead><tr><th scope="col">สินค้า</th><th scope="col" className="num">จำนวน</th><th scope="col" className="num">มูลค่า (ทุน)</th></tr></thead>
              <tbody>{r.topOut.map((t) => <tr key={t.name}><th scope="row">{t.name}</th><td className="num" data-label="จำนวน">{formatInt(t.qty)} {t.unit}</td><td className="num" data-label="มูลค่า">{formatBahtFromSatang(t.value)}</td></tr>)}</tbody></table>
          </>)}
          <h3 className="mini-title">ต้องสั่งเพิ่ม ({r.attention.length})</h3>
          {r.attention.length === 0 ? <p className="muted">ไม่มี</p> : (
            <table className="tbl"><thead><tr><th scope="col">สินค้า</th><th scope="col" className="num">คงเหลือ</th><th scope="col" className="num">แนะนำสั่ง</th><th scope="col">ซัพพลายเออร์</th><th scope="col">สถานะ</th></tr></thead>
              <tbody>{r.attention.map((p) => <tr key={p.id}><th scope="row">{p.name}</th><td className="num" data-label="คงเหลือ">{formatInt(p.total)} {p.unit}</td><td className="num" data-label="แนะนำสั่ง">{formatInt(suggestedOrderQty(p))}</td><td data-label="ซัพพลายเออร์">{p.supplier ?? "—"}</td><td data-label="สถานะ"><StockBadge status={p.status} /></td></tr>)}</tbody></table>
          )}
          <p className="muted small">มูลค่าคิดจากราคาทุนล่าสุดของสินค้า · ข้อมูลจากการบันทึกในระบบนี้เท่านั้น</p>
        </div>
      </article>
      <article className="card panel report-text no-print" aria-labelledby="rt-title" data-tab="text">
        <div className="panel-head">
          <span className="badge-icon tone-green" aria-hidden="true"><ClipboardList /></span>
          <div className="panel-head-text"><h2 className="panel-title" id="rt-title">ข้อความพร้อมส่ง</h2><p className="panel-sub">คัดลอกหรือส่งเข้า LINE ได้ทันที</p></div>
        </div>
        <ReportActions text={text} exportHref={exportHref} />
        <div className="card-body"><pre className="report-pre">{text}</pre></div>
      </article>
    </div>
  );
}
