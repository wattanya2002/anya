/** R-SOC-01 / R-REP-01 helpers. Return null (shown as "N/A") instead of Infinity/NaN. */
export function growthPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function achievementPct(actual: number, target: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return null;
  return (actual / target) * 100;
}

export function ratePct(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

/** Percentage-point difference; null when either side is unavailable. */
export function pointDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

/** Reverse planning: required qualified leads = ceil(target paid bookings / lead-to-booking rate). */
export function requiredLeads(targetPaidBookings: number, leadToBookingRate: number): number | null {
  if (!(leadToBookingRate > 0) || leadToBookingRate > 1 || targetPaidBookings < 0) return null;
  return Math.max(0, Math.ceil(targetPaidBookings / leadToBookingRate - 1e-9));
}
