import "server-only";
import { db } from "./db";
import { ceoInbox, type CeoCard } from "./kol";
import { parseCeoTab, type CeoTab } from "./kol-core";

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Request ids of one CEO tab, in the same order as the queue (latest round per applicant only). */
export async function ceoQueueIds(orgId: string, tab: CeoTab): Promise<string[]> {
  const args: unknown[] = [orgId];
  let where = `r.org_id = $1 and a.erased_at is null and r.round_no = (select max(round_no) from kol_approval_requests x where x.applicant_id = r.applicant_id)`;
  if (tab !== "all") { args.push(tab); where += ` and r.status = $${args.length}`; }
  const order = tab === "pending" ? "r.submitted_at asc" : "coalesce(r.decided_at, r.submitted_at) desc";
  const { rows } = await db().query(
    `select r.id from kol_approval_requests r join kol_applicants a on a.id = r.applicant_id where ${where} order by ${order} limit 100`, args);
  return rows.map((r) => r.id as string);
}

/** The newest round of the same applicant, for a link that points at an older round. */
export async function latestRequestId(orgId: string, id: string): Promise<string | null> {
  if (!isUuid(id)) return null;
  const { rows } = await db().query(
    `select r2.id from kol_approval_requests r join kol_approval_requests r2 on r2.applicant_id = r.applicant_id
      where r.id = $1 and r.org_id = $2 order by r2.round_no desc limit 1`, [id, orgId]);
  return rows[0]?.id ?? null;
}

export type CeoContext = { card: CeoCard; tab: CeoTab; ids: string[]; index: number; total: number };

/** One card plus where it sits in its tab ("1 / 8"). Falls back to the card's own status tab. */
export async function ceoContext(orgId: string, id: string, tabParam: string | undefined): Promise<CeoContext | { moved: string } | null> {
  if (!isUuid(id)) return null;
  const [card] = await ceoInbox(orgId, "all", id);
  if (!card) {
    const latest = await latestRequestId(orgId, id);
    return latest && latest !== id ? { moved: latest } : null;
  }
  const own = parseCeoTab(card.requestStatus);
  let tab = tabParam ? parseCeoTab(tabParam) : own;
  let ids = await ceoQueueIds(orgId, tab);
  if (!ids.includes(id)) { tab = own; ids = await ceoQueueIds(orgId, tab); }
  const index = Math.max(0, ids.indexOf(id));
  return { card, tab, ids, index, total: Math.max(ids.length, 1) };
}

export const tabQs = (tab: CeoTab) => (tab === "pending" ? "" : `?tab=${tab}`);
