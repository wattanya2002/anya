/** Stock ledger core (R-INV-01). Framework-free so it can be tested against a real database.
 *  Every quantity change = one stock_movements row + the matching stock_balances update,
 *  in the caller's transaction, with the balance row locked. Stock can never go negative. */
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

export const MOVEMENT_TYPES = ["OPENING", "RECEIVE", "ISSUE", "SALE", "DAMAGE", "EXPIRED", "ADJUST", "TRANSFER_OUT", "TRANSFER_IN"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export const INBOUND: MovementType[] = ["OPENING", "RECEIVE", "TRANSFER_IN"];
export const OUTBOUND: MovementType[] = ["ISSUE", "SALE", "DAMAGE", "EXPIRED", "TRANSFER_OUT"];

export const MOVEMENT_TH: Record<MovementType, string> = {
  OPENING: "ยอดตั้งต้น", RECEIVE: "รับเข้า", ISSUE: "เบิกใช้", SALE: "ขาย", DAMAGE: "ชำรุด",
  EXPIRED: "หมดอายุ", ADJUST: "ปรับยอด (นับจริง)", TRANSFER_OUT: "ย้ายออก", TRANSFER_IN: "ย้ายเข้า",
};

export type StockErrorCode = "INSUFFICIENT" | "INVALID" | "NOT_FOUND";
export class StockError extends Error {
  code: StockErrorCode;
  constructor(code: StockErrorCode, message: string) { super(message); this.code = code; }
}

/** Signed delta for a movement. `qty` is a positive whole number, except ADJUST which takes a signed, non-zero delta. */
export function signedDelta(type: MovementType, qty: number): number {
  if (!Number.isInteger(qty) || qty === 0) throw new StockError("INVALID", "จำนวนต้องเป็นจำนวนเต็มที่ไม่ใช่ 0");
  if (type === "ADJUST") return qty;
  if (qty < 0) throw new StockError("INVALID", "จำนวนต้องมากกว่า 0");
  if (INBOUND.includes(type)) return qty;
  if (OUTBOUND.includes(type)) return -qty;
  throw new StockError("INVALID", "ประเภทการเคลื่อนไหวไม่ถูกต้อง");
}

export type MovementInput = {
  orgId: string; productId: string; locationId: string; type: MovementType; qty: number;
  actorUserId: string | null; note?: string | null; reference?: string | null; unitCostSatang?: number | null;
  idempotencyKey?: string | null; importJobId?: string | null; transferGroup?: string | null;
};

export type MovementResult = { movementId: number; balanceAfter: number; duplicate: boolean };

export async function ensureDefaultLocations(c: PoolClient, orgId: string) {
  await c.query(
    `insert into inventory_locations (org_id, name, kind, sort_order)
     select $1, v.name, v.kind, v.sort from (values ('คลังสินค้า', 'warehouse', 1), ('ตู้ขายน้ำ', 'cabinet', 2)) v(name, kind, sort)
      where not exists (select 1 from inventory_locations where org_id = $1)`,
    [orgId],
  );
}

/** Must run inside a transaction (caller owns BEGIN/COMMIT). */
export async function recordMovement(c: PoolClient, m: MovementInput): Promise<MovementResult> {
  const delta = signedDelta(m.type, m.qty);
  if (m.idempotencyKey) {
    const dup = await c.query(
      `select id, balance_after from stock_movements where org_id = $1 and idempotency_key = $2 and product_id = $3 and location_id = $4`,
      [m.orgId, m.idempotencyKey, m.productId, m.locationId],
    );
    if (dup.rows[0]) return { movementId: Number(dup.rows[0].id), balanceAfter: dup.rows[0].balance_after, duplicate: true };
  }
  const owns = await c.query(
    `select (select count(*) from products where id = $2 and org_id = $1)::int as p,
            (select count(*) from inventory_locations where id = $3 and org_id = $1)::int as l`,
    [m.orgId, m.productId, m.locationId],
  );
  if (owns.rows[0].p !== 1 || owns.rows[0].l !== 1) throw new StockError("NOT_FOUND", "ไม่พบสินค้าหรือที่เก็บ");

  await c.query(
    `insert into stock_balances (org_id, product_id, location_id, qty) values ($1, $2, $3, 0) on conflict do nothing`,
    [m.orgId, m.productId, m.locationId],
  );
  const bal = await c.query(
    `select qty from stock_balances where product_id = $1 and location_id = $2 for update`,
    [m.productId, m.locationId],
  );
  const next = bal.rows[0].qty + delta;
  if (next < 0) throw new StockError("INSUFFICIENT", `สต็อกไม่พอ (คงเหลือ ${bal.rows[0].qty})`);
  await c.query(
    `update stock_balances set qty = $3, updated_at = now() where product_id = $1 and location_id = $2`,
    [m.productId, m.locationId, next],
  );
  const ins = await c.query(
    `insert into stock_movements (org_id, product_id, location_id, type, qty_delta, balance_after, unit_cost_satang, note, reference,
                                  transfer_group, import_job_id, idempotency_key, actor_user_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
    [m.orgId, m.productId, m.locationId, m.type, delta, next, m.unitCostSatang ?? null, m.note || null, m.reference || null,
     m.transferGroup ?? null, m.importJobId ?? null, m.idempotencyKey || null, m.actorUserId],
  );
  return { movementId: Number(ins.rows[0].id), balanceAfter: next, duplicate: false };
}

/** Moves stock between two locations as one TRANSFER_OUT + TRANSFER_IN pair (not a sale). */
export async function transferStock(c: PoolClient, t: {
  orgId: string; productId: string; fromLocationId: string; toLocationId: string; qty: number;
  actorUserId: string | null; note?: string | null; idempotencyKey?: string | null;
}) {
  if (t.fromLocationId === t.toLocationId) throw new StockError("INVALID", "ต้นทางและปลายทางต้องต่างกัน");
  const group = randomUUID();
  // Lock both balance rows in a fixed order to avoid deadlocks between opposite transfers.
  for (const loc of [t.fromLocationId, t.toLocationId].sort()) {
    await c.query(`insert into stock_balances (org_id, product_id, location_id, qty) values ($1,$2,$3,0) on conflict do nothing`, [t.orgId, t.productId, loc]);
    await c.query(`select 1 from stock_balances where product_id = $1 and location_id = $2 for update`, [t.productId, loc]);
  }
  const out = await recordMovement(c, { ...t, locationId: t.fromLocationId, type: "TRANSFER_OUT", transferGroup: group });
  const inn = await recordMovement(c, { ...t, locationId: t.toLocationId, type: "TRANSFER_IN", transferGroup: group });
  return { out, in: inn };
}

/** "Count adjustment": sets the location balance to the counted quantity with one ADJUST row. */
export async function setCountedQty(c: PoolClient, a: {
  orgId: string; productId: string; locationId: string; countedQty: number; actorUserId: string | null; note?: string | null; idempotencyKey?: string | null;
}) {
  if (!Number.isInteger(a.countedQty) || a.countedQty < 0) throw new StockError("INVALID", "จำนวนที่นับได้ต้องเป็นจำนวนเต็ม ≥ 0");
  await c.query(`insert into stock_balances (org_id, product_id, location_id, qty) values ($1,$2,$3,0) on conflict do nothing`, [a.orgId, a.productId, a.locationId]);
  const cur = await c.query(`select qty from stock_balances where product_id = $1 and location_id = $2 for update`, [a.productId, a.locationId]);
  const delta = a.countedQty - cur.rows[0].qty;
  if (delta === 0) return null;
  return recordMovement(c, { ...a, type: "ADJUST", qty: delta });
}

/** LINE contact input → https URL. Accepts a full line.me / lin.ee URL, "@officialId" or a personal LINE ID. */
export function normalizeLine(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^https:\/\/(line\.me|lin\.ee|page\.line\.me)\//i.test(v)) return v;
  if (/^http:\/\/(line\.me|lin\.ee)\//i.test(v)) return v.replace(/^http:/i, "https:");
  if (/^@[A-Za-z0-9._-]{2,40}$/.test(v)) return `https://line.me/R/ti/p/${encodeURIComponent(v)}`;
  if (/^[A-Za-z0-9._-]{3,40}$/.test(v)) return `https://line.me/R/ti/p/~${v}`;
  throw new StockError("INVALID", "ลิงก์หรือ ID LINE ไม่ถูกต้อง (ใช้ https://line.me/..., https://lin.ee/..., @ไอดีร้าน หรือ ไอดีส่วนตัว)");
}

export function normalizePhone(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const cleaned = v.replace(/[^\d+]/g, "");
  if (!/^\+?\d{6,15}$/.test(cleaned)) throw new StockError("INVALID", "เบอร์โทรไม่ถูกต้อง");
  return cleaned;
}

/** Baht text (e.g. "1,234.50") → satang integer; empty → null. Rejects more than 2 decimals. */
export function bahtToSatang(input: string): number | null {
  const v = input.replace(/[,\s฿]/g, "");
  if (!v) return null;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(v)) throw new StockError("INVALID", "จำนวนเงินไม่ถูกต้อง");
  const [b, s = ""] = v.split(".");
  return Number(b) * 100 + Number((s + "00").slice(0, 2));
}
