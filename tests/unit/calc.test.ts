import { test } from "node:test";
import assert from "node:assert/strict";
import { simulatePromotion } from "../../lib/calc/promotion.ts";
import { planReorder } from "../../lib/calc/reorder.ts";
import { growthPct, achievementPct, ratePct, pointDelta, requiredLeads } from "../../lib/calc/kpi.ts";
import { windows, addDays, parseRange } from "../../lib/dates.ts";

const THB = 100; // satang

test("R-PRO-01 sample: P450 d10% C100 B4 H7 A300 X0 → +435 THB, break-even 6h", () => {
  const r = simulatePromotion({ basePrice: 450 * THB, discountBps: 1000, variableCost: 100 * THB, baselineHours: 4, promoHours: 7, campaignSpend: 300 * THB, extraCosts: 0 });
  assert.equal(r.promoPrice, 405 * THB);
  assert.equal(r.baselineContribution, 1400 * THB);
  assert.equal(r.campaignContribution, 1835 * THB);
  assert.equal(r.incrementalContribution, 435 * THB);
  assert.equal(r.breakEvenHours, 6);
});

test("promotion: zero/negative unit margin is not feasible (no division by zero)", () => {
  const r = simulatePromotion({ basePrice: 100 * THB, discountBps: 5000, variableCost: 50 * THB, baselineHours: 2, promoHours: 5, campaignSpend: 0, extraCosts: 0 });
  assert.equal(r.breakEvenHours, null);
  assert.equal(r.feasibleWithinCapacity, false);
  const neg = simulatePromotion({ basePrice: 100 * THB, discountBps: 9000, variableCost: 50 * THB, baselineHours: 2, promoHours: 5, campaignSpend: 0, extraCosts: 0 });
  assert.equal(neg.breakEvenHours, null);
});

test("promotion: capacity check and input validation", () => {
  const r = simulatePromotion({ basePrice: 450 * THB, discountBps: 1000, variableCost: 100 * THB, baselineHours: 4, promoHours: 7, campaignSpend: 300 * THB, extraCosts: 0, capacityHours: 5 });
  assert.equal(r.feasibleWithinCapacity, false);
  assert.throws(() => simulatePromotion({ basePrice: -1, discountBps: 0, variableCost: 0, baselineHours: 0, promoHours: 0, campaignSpend: 0, extraCosts: 0 }), RangeError);
  assert.throws(() => simulatePromotion({ basePrice: 1, discountBps: 10001, variableCost: 0, baselineHours: 0, promoHours: 0, campaignSpend: 0, extraCosts: 0 }), RangeError);
});

test("R-INV-02 reorder: rounds up to full packs and counts on-order units", () => {
  const r = planReorder({ avgDailySales: 10, leadDays: 3, bufferDays: 2, reviewDays: 7, onHand: 30, onOrder: 10, reserved: 0, packSize: 24 });
  assert.equal(r.safetyStock, 20);
  assert.equal(r.reorderPoint, 50);
  assert.equal(r.inventoryPosition, 40);
  assert.equal(r.shouldReorder, true);
  assert.equal(r.rawUnits, 80);            // target 120 - position 40
  assert.equal(r.recommendedUnits, 96);    // 4 packs of 24
  const covered = planReorder({ avgDailySales: 10, leadDays: 3, bufferDays: 2, reviewDays: 7, onHand: 30, onOrder: 40, reserved: 0, packSize: 24 });
  assert.equal(covered.shouldReorder, false);
  assert.equal(covered.recommendedUnits, 0);
});

test("reorder: MOQ applied in whole packs", () => {
  const r = planReorder({ avgDailySales: 1, leadDays: 2, bufferDays: 1, reviewDays: 1, onHand: 1, onOrder: 0, reserved: 0, packSize: 6, moq: 30 });
  assert.equal(r.recommendedUnits, 30);
  assert.equal(r.packs, 5);
});

test("KPI guards return N/A (null) instead of Infinity", () => {
  assert.equal(growthPct(10, 0), null);
  assert.equal(achievementPct(5, 0), null);
  assert.equal(ratePct(1, 0), null);
  assert.equal(pointDelta(null, 5), null);
  assert.ok(Math.abs(growthPct(112.6, 100)! - 12.6) < 1e-9);
  assert.equal(requiredLeads(20, 0.25), 80);
  assert.equal(requiredLeads(21, 0.25), 84);
  assert.equal(requiredLeads(10, 0), null);
});

test("date windows are contiguous Bangkok calendar ranges", () => {
  const w = windows(30, "2026-11-02");
  assert.deepEqual(w, { curStart: "2026-10-04", curEnd: "2026-11-02", prevStart: "2026-09-04", prevEnd: "2026-10-03" });
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(parseRange("90"), 90);
  assert.equal(parseRange("1000"), 30);
});

test("zero inputs never produce negative zero", () => {
  const r = simulatePromotion({ basePrice: 450 * THB, discountBps: 0, variableCost: 100 * THB, baselineHours: 0, promoHours: 0, campaignSpend: 0, extraCosts: 0 });
  assert.equal(Object.is(r.breakEvenHours, 0), true);
  assert.equal(Object.is(requiredLeads(0, 0.5), 0), true);
});
