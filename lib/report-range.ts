import { addDays, bangkokToday } from "./dates";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Resolves report period from query params; defaults to the last 30 days; caps at 366 days. */
export function reportRange(sp: { from?: string; to?: string; preset?: string }) {
  const today = bangkokToday();
  if (sp.preset === "7") return { from: addDays(today, -6), to: today, preset: "7" };
  if (sp.preset === "month") return { from: `${today.slice(0, 8)}01`, to: today, preset: "month" };
  if (sp.preset === "lastmonth") {
    const firstThis = `${today.slice(0, 8)}01`;
    const lastPrev = addDays(firstThis, -1);
    return { from: `${lastPrev.slice(0, 8)}01`, to: lastPrev, preset: "lastmonth" };
  }
  let from = sp.from && ISO.test(sp.from) ? sp.from : addDays(today, -29);
  let to = sp.to && ISO.test(sp.to) ? sp.to : today;
  if (from > to) [from, to] = [to, from];
  if (addDays(from, 366) < to) from = addDays(to, -366);
  return { from, to, preset: sp.from || sp.to ? "custom" : "30" };
}
