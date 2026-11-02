/** R-INV-02 Reorder planner (units). */
export type ReorderInput = {
  avgDailySales: number; // units/day
  leadDays: number;      // L
  bufferDays: number;    // S
  reviewDays: number;    // R
  onHand: number;        // OH (sum across locations, counted once)
  onOrder: number;       // OO open PO units
  reserved: number;      // RO backorders/reserved
  packSize: number;      // K
  moq?: number;          // supplier minimum order units
};

export type ReorderResult = {
  safetyStock: number;
  reorderPoint: number;
  inventoryPosition: number;
  targetStock: number;
  shouldReorder: boolean;
  rawUnits: number;
  recommendedUnits: number;
  packs: number;
};

export function planReorder(i: ReorderInput): ReorderResult {
  if (!(i.packSize >= 1) || !Number.isInteger(i.packSize)) throw new RangeError("packSize must be a positive integer");
  for (const [k, v] of Object.entries(i)) {
    if (v !== undefined && (!Number.isFinite(v) || v < 0)) throw new RangeError(`${k} must be a non-negative number`);
  }
  const safetyStock = i.avgDailySales * i.bufferDays;
  const reorderPoint = i.avgDailySales * i.leadDays + safetyStock;
  const inventoryPosition = i.onHand + i.onOrder - i.reserved;
  const targetStock = i.avgDailySales * (i.leadDays + i.bufferDays + i.reviewDays);
  const shouldReorder = inventoryPosition <= reorderPoint;
  const rawUnits = shouldReorder ? Math.max(0, targetStock - inventoryPosition) : 0;
  let packs = rawUnits > 0 ? Math.ceil(rawUnits / i.packSize - 1e-9) : 0;
  if (shouldReorder && rawUnits > 0 && i.moq && packs * i.packSize < i.moq) packs = Math.ceil(i.moq / i.packSize);
  return { safetyStock, reorderPoint, inventoryPosition, targetStock, shouldReorder, rawUnits, recommendedUnits: packs * i.packSize, packs };
}
