import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/auth";
import { getRequest, type RequestDetail, mkViewer } from "@/lib/mk";
import { bangkokToday } from "@/lib/dates";
import { addDays } from "@/lib/calendar-core";
import { RequestForm } from "@/components/mk/request-form";

export const metadata = { title: "ส่งคำขอ · MK" };

const s = (v: number | null) => (v === null ? "" : String(v));
const money = (v: number | null) => (v === null ? "" : (v / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }));
const on = (b: boolean) => (b ? "on" : "");

/** Request → the flat field map the form posts (same names validateRequestInput reads). */
function toFields(r: RequestDetail): Record<string, string> {
  const f: Record<string, string> = {
    id: r.id, kind: r.kind, title: r.title, summary: r.summary, amount: money(r.amountSatang), channel: r.channel ?? "", goal: r.goal ?? "",
    ad_copy: r.adCopy ?? "", plan: r.plan ?? "", discount_text: r.discountText ?? "", conditions: r.conditions ?? "",
    starts_on: r.startsOn ?? "", ends_on: r.endsOn ?? "", all_day: on(r.allDay), start_time: r.startTime ?? "", end_time: r.endTime ?? "",
    decide_by: r.decideBy, urgent: on(r.urgent), travel_minutes: String(r.travelMinutes), repeat: r.repeat, remind: on(!!r.remindOn),
    remind_on: r.remindOn ?? "", remind_time: r.remindTime ?? "", remind_before: r.remindBefore, remind_location: on(r.remindLocation),
    remind_messaging: on(r.remindMessaging), calendar_list: r.calendarList, invitees: r.invitees ?? "", tags: r.tags.join(","),
    flagged: on(r.flagged), priority: r.priority, note: r.note ?? "", link_url: r.linkUrl ?? "",
  };
  r.attachments.forEach((a, i) => { f[`att_kind.${i}`] = a.kind; f[`att_url.${i}`] = a.url; f[`att_label.${i}`] = a.label; });
  r.people.forEach((p, i) => {
    Object.assign(f, {
      [`p_name.${i}`]: p.name, [`p_platform.${i}`]: p.platform, [`p_handle.${i}`]: p.handle ?? "", [`p_followers.${i}`]: s(p.followers),
      [`p_fee.${i}`]: money(p.feeSatang), [`p_views.${i}`]: s(p.avgViews), [`p_eng.${i}`]: p.engagementBps === null ? "" : String(p.engagementBps / 100),
      [`p_audience.${i}`]: p.audience ?? "", [`p_deliver.${i}`]: p.deliverables ?? "", [`p_deliver_by.${i}`]: p.deliverBy ?? "",
      [`p_cond.${i}`]: p.conditions ?? "", [`p_fit.${i}`]: p.fitNote ?? "", [`p_photo.${i}`]: p.photoUrl ?? "", [`p_profile.${i}`]: p.profileUrl ?? "",
    });
  });
  return f;
}

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await mkViewer();
  if (!can(user, "approvals.submit")) redirect("/mk");
  let initial: Record<string, string> = { kind: "ad", decide_by: addDays(bangkokToday(), 3), travel_minutes: "0", repeat: "none", calendar_list: "marketing", priority: "normal", remind_before: "none" };
  let cancel = "/mk";
  if (sp.edit) {
    const r = await getRequest(user, sp.edit);
    if (!r) notFound();
    if (r.status === "approved" || (r.submittedBy !== user.id && !can(user, "admin.manage"))) redirect(`/mk/requests/${r.id}`);
    initial = toFields(r);
    cancel = `/mk/requests/${r.id}`;
  }
  return (
    <div className="ap" data-tone="form">
      <RequestForm initial={initial} isEdit={!!sp.edit} cancelHref={cancel} />
    </div>
  );
}
