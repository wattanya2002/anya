/* Shared CEO Approval pieces (Master RCM screens 05–15). No server imports, so client components can use them too. */
import Link from "next/link";
import { Check, MessageSquareMore, X } from "lucide-react";
import { DECISION_LABEL, applicantRef, type CeoTab } from "@/lib/kol-core";
import { KolPhoto, SocialPair, type SocialLite } from "./people";

export type DecidedInfo = { decision: string; byName: string; at: string | Date; note?: string | null } | null;

const dtf = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
export const when = (d: Date | string) => dtf.format(new Date(d));

const q = (tab: CeoTab) => (tab === "pending" ? "" : `?tab=${tab}`);
export const ceoHref = {
  queue: (tab: CeoTab) => `/kol/ceo${q(tab)}`,
  card: (id: string, tab: CeoTab) => `/kol/ceo/r/${id}${q(tab)}`,
  hub: (id: string, tab: CeoTab) => `/kol/ceo/r/${id}/hub${q(tab)}`,
  section: (id: string, s: string, tab: CeoTab) => `/kol/ceo/r/${id}/${s}${q(tab)}`,
  decide: (id: string, kind: "reject" | "request" | "approve", tab: CeoTab) => `/kol/ceo/r/${id}/decide/${kind}${q(tab)}`,
  done: (id: string, tab: CeoTab) => `/kol/ceo/r/${id}/done${q(tab)}`,
};

/** X · request · ✓ — each opens its own confirmation screen; nothing changes on a single tap. */
export function DecisionLinks({ id, tab, name }: { id: string; tab: CeoTab; name: string }) {
  return (
    <div className="k-dec" role="group" aria-label={`ตัดสินใจเรื่อง ${name}`}>
      <Link href={ceoHref.decide(id, "reject", tab)} className="k-dbtn x" aria-label={`ไม่อนุมัติ ${name}`} title="ไม่อนุมัติ"><X aria-hidden="true" /></Link>
      <Link href={ceoHref.decide(id, "request", tab)} className="k-dbtn ask" aria-label={`ขอข้อมูลเพิ่มจาก ${name}`} title="ขอข้อมูลเพิ่ม"><MessageSquareMore aria-hidden="true" /></Link>
      <Link href={ceoHref.decide(id, "approve", tab)} className="k-dbtn ok" aria-label={`อนุมัติ ${name}`} title="อนุมัติ"><Check aria-hidden="true" /></Link>
    </div>
  );
}

export function DecidedLine({ d }: { d: NonNullable<DecidedInfo> }) {
  return <><b>{DECISION_LABEL[d.decision] ?? d.decision}</b> โดย {d.byName} · {when(d.at)}</>;
}

/** Bottom of a CEO screen: decisions for the CEO on a pending card, otherwise who decided (or that only the CEO decides). */
export function DecisionArea({ id, tab, name, pending, canDecide, decided }: { id: string; tab: CeoTab; name: string; pending: boolean; canDecide: boolean; decided: DecidedInfo }) {
  if (pending && canDecide) return <div className="k-dec-bar"><DecisionLinks id={id} tab={tab} name={name} /></div>;
  if (decided) return <div className="k-mc-done" data-s={decided.decision} style={{ position: "static" }} role="status"><DecidedLine d={decided} /></div>;
  return <div className="k-mc-done" data-s="view" style={{ position: "static" }}>รอ CEO พิจารณา — ตัดสินใจได้เฉพาะ CEO</div>;
}

/** Compact profile strip at the top of detail / decision screens. */
export function CeoStrip({ name, refNo, photoFileId, social, pink = false }: { name: string; refNo: number; photoFileId: string | null; social: SocialLite[]; pink?: boolean }) {
  return (
    <div className={`k-strip${pink ? " pink" : ""}`}>
      <KolPhoto name={name} fileId={photoFileId} />
      <div style={{ minWidth: 0 }}>
        <h2 className="k-app-name"><b style={{ fontSize: 26 }}>{name}</b><span className="k-code">{applicantRef(refNo)}</span></h2>
        <SocialPair social={social} />
      </div>
    </div>
  );
}
