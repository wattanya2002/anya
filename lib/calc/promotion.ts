/** R-PRO-01 Promotion calculator. All money values are integer satang. */
export type PromotionInput = {
  basePrice: number;       // P per hour
  discountBps: number;     // d in basis points (1000 = 10%)
  variableCost: number;    // C per hour
  baselineHours: number;   // B
  promoHours: number;      // H
  campaignSpend: number;   // A
  extraCosts: number;      // X
  capacityHours?: number;  // optional sellable slot capacity
};

export type PromotionResult = {
  promoPrice: number;
  baselineContribution: number;
  campaignContribution: number;
  incrementalContribution: number;
  breakEvenHours: number | null;   // null = not feasible (P' - C <= 0)
  feasibleWithinCapacity: boolean | null;
};

export function simulatePromotion(i: PromotionInput): PromotionResult {
  for (const [k, v] of Object.entries(i)) {
    if (v !== undefined && (!Number.isFinite(v) || v < 0)) throw new RangeError(`${k} must be a non-negative number`);
  }
  if (i.discountBps > 10000) throw new RangeError("discountBps must be <= 10000");
  // P' = P * (1 - d); rounded to whole satang
  const promoPrice = Math.round((i.basePrice * (10000 - i.discountBps)) / 10000);
  const unitMargin = promoPrice - i.variableCost;
  const baselineContribution = i.baselineHours * (i.basePrice - i.variableCost);
  // The discount applies to ALL qualifying promotional hours, not only the additional ones.
  const campaignContribution = i.promoHours * unitMargin - i.campaignSpend - i.extraCosts;
  const incrementalContribution = campaignContribution - baselineContribution;
  const breakEvenHours =
    unitMargin > 0 ? Math.max(0, Math.ceil((baselineContribution + i.campaignSpend + i.extraCosts) / unitMargin - 1e-9)) : null;
  const feasibleWithinCapacity =
    breakEvenHours === null ? false : i.capacityHours === undefined ? null : breakEvenHours <= i.capacityHours;
  return { promoPrice, baselineContribution, campaignContribution, incrementalContribution, breakEvenHours, feasibleWithinCapacity };
}
