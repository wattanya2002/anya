"use client";
import Link from "next/link";
import { useActionState } from "react";
import { saveProduct } from "@/app/(app)/inventory/actions";
import type { FormState } from "@/app/actions";
import type { Option, ProductRow, Location } from "@/lib/inventory";

const baht = (s: number | null | undefined) => (s === null || s === undefined ? "" : (s / 100).toFixed(2).replace(/\.00$/, ""));

export function ProductForm({ product, categories, brands, suppliers, locations }: {
  product: ProductRow | null; categories: Option[]; brands: Option[]; suppliers: Option[]; locations: Location[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProduct, {});
  const f = state.fields;
  const v = (k: string, fallback: string | number | null | undefined) => (f && k in f ? f[k] : fallback ?? "") as string;
  return (
    <form action={action} className="form-grid" key={product ? product.id : state.nonce ?? "new"}>
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="field span-2"><label htmlFor="p-name">ชื่อสินค้า *</label><input id="p-name" name="name" required maxLength={160} defaultValue={v("name", product?.name)} /></div>
      <div className="field"><label htmlFor="p-sku">รหัสสินค้า (SKU) *</label><input id="p-sku" name="sku" required maxLength={40} pattern="[A-Za-z0-9._\-]{1,40}" autoCapitalize="characters" defaultValue={v("sku", product?.sku)} /></div>
      <div className="field"><label htmlFor="p-barcode">บาร์โค้ด</label><input id="p-barcode" name="barcode" inputMode="numeric" maxLength={32} defaultValue={v("barcode", product?.barcode)} /></div>
      <div className="field"><label htmlFor="p-cat">ประเภท</label><input id="p-cat" name="category" list="cat-list" maxLength={80} placeholder="เช่น เครื่องดื่ม" defaultValue={v("category", product?.category)} />
        <datalist id="cat-list">{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist></div>
      <div className="field"><label htmlFor="p-brand">ยี่ห้อ/แบรนด์</label><input id="p-brand" name="brand" list="brand-list" maxLength={80} defaultValue={v("brand", product?.brand)} />
        <datalist id="brand-list">{brands.map((b) => <option key={b.id} value={b.name} />)}</datalist></div>
      <div className="field"><label htmlFor="p-unit">หน่วย</label><input id="p-unit" name="unit" maxLength={20} placeholder="ชิ้น / ขวด / กระป๋อง" defaultValue={v("unit", product?.unit ?? "ชิ้น")} /></div>
      <div className="field"><label htmlFor="p-pack">จำนวนต่อแพ็ก/ลัง</label><input id="p-pack" name="packSize" type="number" inputMode="numeric" min={1} step={1} defaultValue={v("packSize", product?.packSize ?? 1)} /></div>
      <div className="field"><label htmlFor="p-cost">ราคาทุน/หน่วย (บาท)</label><input id="p-cost" name="cost" inputMode="decimal" defaultValue={v("cost", baht(product?.costSatang))} /></div>
      <div className="field"><label htmlFor="p-price">ราคาขาย/หน่วย (บาท)</label><input id="p-price" name="price" inputMode="decimal" defaultValue={v("price", baht(product?.priceSatang))} /></div>
      <div className="field"><label htmlFor="p-rp">จุดสั่งซื้อ (เหลือเท่านี้ให้เตือน)</label><input id="p-rp" name="reorderPoint" type="number" inputMode="numeric" min={0} step={1} defaultValue={v("reorderPoint", product?.reorderPoint ?? 0)} /></div>
      <div className="field"><label htmlFor="p-rq">จำนวนสั่งต่อครั้ง</label><input id="p-rq" name="reorderQty" type="number" inputMode="numeric" min={0} step={1} defaultValue={v("reorderQty", product?.reorderQty ?? 0)} /></div>
      <div className="field span-2"><label htmlFor="p-sup">ซัพพลายเออร์</label>
        <select id="p-sup" name="supplierId" defaultValue={v("supplierId", product?.supplierId)}>
          <option value="">— ไม่ระบุ —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <small className="muted">ยังไม่มีในรายการ? <Link href="/inventory/suppliers">เพิ่มซัพพลายเออร์</Link></small>
      </div>
      {!product && (
        <>
          <div className="field"><label htmlFor="p-open">ยอดเริ่มต้น (ไม่บังคับ)</label><input id="p-open" name="openingQty" type="number" inputMode="numeric" min={0} step={1} defaultValue={v("openingQty", "")} /></div>
          <div className="field"><label htmlFor="p-oloc">เก็บที่</label>
            <select id="p-oloc" name="openingLocation" defaultValue={v("openingLocation", locations[0]?.id)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        </>
      )}
      <div className="field span-2"><label htmlFor="p-note">หมายเหตุ</label><input id="p-note" name="note" maxLength={500} defaultValue={v("note", product?.note)} /></div>
      {product && (
        <label className="check span-2"><input type="checkbox" name="isActive" defaultChecked={product.isActive} /> ใช้งานอยู่ (เอาติ๊กออกเพื่อซ่อนสินค้าที่เลิกขาย ประวัติยังอยู่ครบ)</label>
      )}
      {state.error && <p className="form-msg err span-2" role="alert">{state.error}</p>}
      {state.ok && <p className="form-msg ok span-2" role="status">{state.ok}</p>}
      <button className="btn span-2" type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : product ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}</button>
    </form>
  );
}
