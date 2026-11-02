"use client";
import { useActionState, useMemo, useState } from "react";
import { recordStock } from "@/app/(app)/inventory/actions";
import type { FormState } from "@/app/actions";

export type MiniProduct = { id: string; name: string; sku: string; unit: string; byLocation: Record<string, number> };
export type MiniLocation = { id: string; name: string };

const OPS: { value: string; label: string; hint: string }[] = [
  { value: "RECEIVE", label: "รับเข้า (+)", hint: "ของเข้ามาใหม่จากซัพพลายเออร์" },
  { value: "ISSUE", label: "เบิกใช้ (−)", hint: "นำไปใช้ในสนาม/งาน" },
  { value: "SALE", label: "ขาย (−)", hint: "ขายให้ลูกค้า (รวมตู้ขายน้ำ)" },
  { value: "TRANSFER", label: "ย้ายที่เก็บ", hint: "เช่น เติมจากคลังไปตู้ขายน้ำ (ไม่ใช่การขาย)" },
  { value: "DAMAGE", label: "ชำรุด (−)", hint: "เสียหาย ใช้ไม่ได้" },
  { value: "EXPIRED", label: "หมดอายุ (−)", hint: "" },
  { value: "COUNT", label: "ปรับตามยอดนับจริง", hint: "กรอกจำนวนที่นับได้จริง ระบบปรับส่วนต่างให้" },
];

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());
}

export function MovementForm({ products, locations, defaultProductId, defaultOp = "RECEIVE", canManage }: {
  products: MiniProduct[]; locations: MiniLocation[]; defaultProductId?: string; defaultOp?: string; canManage: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordStock, {});
  const [op, setOp] = useState(state.fields?.op ?? defaultOp);
  const [productId, setProductId] = useState(state.fields?.productId ?? defaultProductId ?? "");
  const [locationId, setLocationId] = useState(state.fields?.locationId ?? locations[0]?.id ?? "");
  const idem = useMemo(() => newKey(), [state.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const product = products.find((p) => p.id === productId);
  const current = product ? product.byLocation[locationId] ?? 0 : null;
  const hint = OPS.find((o) => o.value === op)?.hint;

  if (!canManage) return <p className="muted">บทบาทของคุณดูข้อมูลได้อย่างเดียว</p>;
  if (products.length === 0) return <p className="muted">ยังไม่มีสินค้า — เพิ่มสินค้าหรือนำเข้าไฟล์ก่อน</p>;

  return (
    <form action={action} className="form-grid" key={state.nonce ?? "mv"}>
      <input type="hidden" name="idem" value={idem} />
      <div className="field">
        <label htmlFor="mv-op">ประเภทรายการ</label>
        <select id="mv-op" name="op" value={op} onChange={(e) => setOp(e.target.value)}>
          {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {hint ? <small className="muted">{hint}</small> : null}
      </div>
      <div className="field">
        <label htmlFor="mv-product">สินค้า</label>
        <select id="mv-product" name="productId" value={productId} onChange={(e) => setProductId(e.target.value)} required>
          <option value="" disabled>เลือกสินค้า</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="mv-loc">{op === "TRANSFER" ? "ย้ายจาก" : "ที่เก็บ"}</label>
        <select id="mv-loc" name="locationId" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {current !== null ? <small className="muted">คงเหลือที่นี่ {current.toLocaleString("en-US")} {product?.unit}</small> : null}
      </div>
      {op === "TRANSFER" && (
        <div className="field">
          <label htmlFor="mv-to">ย้ายไปที่</label>
          <select id="mv-to" name="toLocationId" defaultValue={state.fields?.toLocationId ?? locations.find((l) => l.id !== locationId)?.id}>
            {locations.filter((l) => l.id !== locationId).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="mv-qty">{op === "COUNT" ? "จำนวนที่นับได้จริง" : "จำนวน"}{product ? ` (${product.unit})` : ""}</label>
        <input id="mv-qty" name="qty" type="number" inputMode="numeric" min={op === "COUNT" ? 0 : 1} step={1} required defaultValue={state.fields?.qty} />
      </div>
      {op === "RECEIVE" && (
        <div className="field">
          <label htmlFor="mv-cost">ราคาทุนต่อหน่วย (บาท) — ไม่บังคับ</label>
          <input id="mv-cost" name="unitCost" inputMode="decimal" placeholder="เช่น 5.50" defaultValue={state.fields?.unitCost} />
        </div>
      )}
      <div className="field">
        <label htmlFor="mv-ref">เลขอ้างอิง — ไม่บังคับ</label>
        <input id="mv-ref" name="reference" maxLength={80} placeholder="เช่น เลขใบส่งของ" defaultValue={state.fields?.reference} />
      </div>
      <div className="field span-2">
        <label htmlFor="mv-note">หมายเหตุ</label>
        <input id="mv-note" name="note" maxLength={300} defaultValue={state.fields?.note} />
      </div>
      {state.error && <p className="form-msg err span-2" role="alert">{state.error}</p>}
      {state.ok && <p className="form-msg ok span-2" role="status">{state.ok}</p>}
      <button className="btn span-2" type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกรายการ"}</button>
    </form>
  );
}
