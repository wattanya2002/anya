import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { kolReady } from "@/lib/kol";
import { ceoContext } from "@/lib/kol-ceo";
import { parseCeoTab } from "@/lib/kol-core";
import { ceoHref } from "@/components/kol/ceo-ui";

export type CeoParams = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Every CEO card screen: signed-in user with kol.view, the card (newest round) and where it sits in its tab. */
export async function loadCeo({ params, searchParams }: CeoParams, suffix: (id: string, tab: ReturnType<typeof parseCeoTab>) => string = ceoHref.card) {
  const user = await requireUser();
  if (!can(user, "kol.view")) notFound();
  await kolReady(user);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await ceoContext(user.orgId, id.toLowerCase(), one(sp.tab) || undefined);
  if (!ctx) notFound();
  if ("moved" in ctx) redirect(suffix(ctx.moved, parseCeoTab(one(sp.tab))));
  return { user, ctx, canDecide: can(user, "kol.decide"), pending: ctx.card.requestStatus === "pending" };
}

export const decidedOf = (c: { decision: { decision: string; byName: string; at: Date; note: string | null } | null }) =>
  c.decision ? { decision: c.decision.decision, byName: c.decision.byName, at: c.decision.at.toISOString(), note: c.decision.note } : null;
