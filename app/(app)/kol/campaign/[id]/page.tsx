import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgePercent, CalendarDays, ClipboardList, Coins, Info, NotebookPen, Activity } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { listParticipants, termsById } from "@/lib/kol";
import { db } from "@/lib/db";
import { applicantRef, creditSummary, deliverableProgress, suggestPromoCode, DELIVERABLE_LABEL, DELIVERABLE_STATUSES, VISIT_LABEL, VISIT_STATUSES } from "@/lib/kol-core";
import { bangkokToday, addDays } from "@/lib/dates";
import { KolHead, KolPhoto, SocialChips, SourceNote, fmtDate, fmtDateTime, Note } from "@/components/kol/ui";
import { ActionForm, CopyButton } from "@/components/kol/client";
import { addCreditEntry, createPromoCode, updateDeliverable, updateParticipant, updateVisit, voidPromoCode } from "../../actions";

const baht = (s: number) => `฿${Math.round(s / 100).toLocaleString("en-US")}`;
const n = (v: number | null) => (v === null ? "–" : v.toLocaleString("en-US"));

export default async function ParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "kol.view")) notFound();
  const { id } = await params;
  const p = (await listParticipants(user.orgId, id))[0];
  if (!p) notFound();
  const edit = can(user, "kol.review");
  const [terms, membership] = await Promise.all([
    db().query(`select terms_id from kol_participants where id = $1`, [p.id]).then((r) => termsById(r.rows[0]?.terms_id ?? null)),
    db().query(`select membership_name from kol_registrations where applicant_id = $1`, [p.applicantId]).then((r) => r.rows[0]?.membership_name as string | null),
  ]);
  const cr = creditSummary(p.credits);
  const prog = deliverableProgress(p.deliverables);
  const tot = p.deliverables.reduce((t, d) => ({ views: t.views + (d.views ?? 0), likes: t.likes + (d.likes ?? 0), comments: t.comments + (d.comments ?? 0), shares: t.shares + (d.shares ?? 0) }), { views: 0, likes: 0, comments: 0, shares: 0 });
  const hasMetrics = p.deliverables.some((d) => d.metricsSource);
  const lastMetrics = p.deliverables.map((d) => d.metricsUpdatedAt).filter(Boolean).sort().at(-1) as Date | undefined;
  const today = bangkokToday();
  const dueBy = terms?.deliverWithinDays && p.visitDate && p.visitStatus === "visited" ? addDays(p.visitDate, terms.deliverWithinDays) : null;

  return (
    <>
      <KolHead user={user} title="จัดการ KOL ในแคมเปญ" sub="Post-Approval Tracking · STEP 2 และผลงาน" back="/kol/campaign" />
      <section className="k-card lg" style={{ marginTop: 22 }} aria-labelledby="p-name">
        <div className="k-row nowrap" style={{ alignItems: "flex-start" }}>
          <KolPhoto name={p.creatorName} fileId={p.photoFileId} size={96} />
          <div className="k-grow">
            <h2 id="p-name" className="k-app-name"><b style={{ fontSize: 24 }}>{p.creatorName}</b><span className="k-code">{applicantRef(p.refNo)}</span></h2>
            <p className="k-muted" style={{ margin: "4px 0 0", fontSize: 14 }}>{p.fullName} · {applicantRef(p.refNo)} · อนุมัติ {fmtDate(p.approvedAt)} · เงื่อนไข v{p.termsVersion}</p>
            <div className="k-row" style={{ marginTop: 8 }}>
              <span className="k-tag">LINE {p.lineId ?? "–"}</span><span className="k-tag">โทร {p.phone ?? "–"}</span>
              <Link href={`/kol/applicants/${p.applicantId}`} className="k-btn sm ghost">ใบสมัคร</Link>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18 }}><SocialChips social={p.social} /></div>
        <dl className="k-kv" style={{ marginTop: 10 }}>
          <div><dt>Applicant ID</dt><dd>{applicantRef(p.refNo)}</dd></div>
          <div><dt>Campaign</dt><dd>{p.campaignName}</dd></div>
          {membership && <div><dt>ชื่อ Membership</dt><dd>{membership}</dd></div>}
        </dl>
      </section>

      <div className="k-grid two">
        <div className="k-stack">
          <section className="k-card" aria-labelledby="h-del">
            <div className="k-card-h"><h2 id="h-del"><ClipboardList aria-hidden="true" />Deliverables ({prog.verified}/{prog.total} ตรวจแล้ว)</h2></div>
            {dueBy && <p className="k-sub">ส่งผลงานภายใน {fmtDate(dueBy)} ({terms!.deliverWithinDays} วันหลังเข้าใช้บริการครั้งแรก){dueBy < today && !prog.done ? " · เลยกำหนดแล้ว" : ""}</p>}
            {p.deliverables.map((d) => (
              <div key={d.id} className="k-deliv">
                <div className="k-row between"><b>{d.label}</b>
                  <span className="k-badge" data-tone={d.status === "verified" ? "green" : d.status === "submitted" ? "amber" : d.status === "in_progress" ? "navy" : "gray"}>{DELIVERABLE_LABEL[d.status]}</span></div>
                {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="k-small" style={{ color: "var(--k-sky-ink)", textDecoration: "underline", overflowWrap: "anywhere" }}>{d.url}</a>}
                {d.verifiedAt && <span className="k-muted k-small">ตรวจโดย {d.verifiedByName} · {fmtDateTime(d.verifiedAt)}</span>}
                {edit ? (
                  <ActionForm action={updateDeliverable} submitLabel="บันทึก" submitClass="k-btn sm primary">
                    <input type="hidden" name="deliverable_id" value={d.id} />
                    <div className="k-form-grid cols2">
                      <label className="k-field"><span className="k-label">สถานะ</span>
                        <select className="k-select" name="status" defaultValue={d.status}>{DELIVERABLE_STATUSES.map((s) => <option key={s} value={s}>{DELIVERABLE_LABEL[s]}</option>)}</select></label>
                      <label className="k-field"><span className="k-label">ลิงก์ผลงานที่โพสต์จริง</span><input className="k-input" name="url" type="url" inputMode="url" defaultValue={d.url ?? ""} placeholder="https://…" /></label>
                    </div>
                    <div className="k-metrics" style={{ marginTop: 10 }}>
                      {(["views", "likes", "comments", "shares"] as const).map((k) => (
                        <label key={k} className="k-field"><span className="k-label">{{ views: "Views", likes: "Likes", comments: "Comments", shares: "Shares" }[k]}</span>
                          <input className="k-input" name={k} inputMode="numeric" defaultValue={d[k] ?? ""} /></label>
                      ))}
                    </div>
                    <label className="k-field" style={{ marginTop: 10 }}><span className="k-label">หมายเหตุ</span><input className="k-input" name="note" defaultValue={d.note ?? ""} maxLength={1000} /></label>
                    <p className="k-hint">ตัวเลขผลลัพธ์เป็นข้อมูลที่ทีมกรอกเอง (ยังไม่เชื่อม API ของ IG / TikTok / Google)</p>
                  </ActionForm>
                ) : (d.views !== null && <p className="k-small">Views {n(d.views)} · Likes {n(d.likes)} · Comments {n(d.comments)} · Shares {n(d.shares)}</p>)}
              </div>
            ))}
          </section>

          <section className="k-card" aria-labelledby="h-perf">
            <div className="k-card-h"><h2 id="h-perf"><Activity aria-hidden="true" />Campaign Performance</h2></div>
            {hasMetrics ? (
              <>
                <div className="k-metrics">
                  <div className="k-stat"><b>{n(tot.views)}</b><span>Views</span></div><div className="k-stat"><b>{n(tot.likes)}</b><span>Likes</span></div>
                  <div className="k-stat"><b>{n(tot.comments)}</b><span>Comments</span></div><div className="k-stat"><b>{n(tot.shares)}</b><span>Shares</span></div>
                </div>
                <p style={{ margin: "10px 0 0" }}><SourceNote>ทีมงานกรอกเอง · อัปเดตล่าสุด {fmtDateTime(lastMetrics ?? null)} · ไม่ใช่ Real-Time</SourceNote></p>
              </>
            ) : <Note>ยังไม่มีตัวเลขผลลัพธ์ — กรอกจากหน้าผลงานแต่ละรายการ (ข้อมูลที่ทีมงานกรอก)</Note>}
            <h3 style={{ fontSize: 14.5, margin: "16px 0 8px" }}>Booking Conversion / Promo Code Usage</h3>
            {p.promos.length === 0 ? <p className="k-muted k-small" style={{ margin: 0 }}>ยังไม่มี Promo Code</p> : (
              <div className="k-table-wrap"><table className="k-table">
                <thead><tr><th>โค้ด</th><th>การจองที่ใช้โค้ด</th><th>ยอดจอง</th><th>แหล่งข้อมูล</th></tr></thead>
                <tbody>{p.promos.map((x) => (
                  <tr key={x.id}><td><b>{x.code}</b></td>
                    <td className="num">{x.usage.linked ? n(x.usage.bookings) : "–"}</td><td className="num">{x.usage.linked ? baht(x.usage.paidSatang) : "–"}</td>
                    <td>{x.usage.linked ? `ข้อมูลการจองที่นำเข้า (โปรฯ “${x.usage.promotionName}”)${x.usage.lastSyncedAt ? ` · นำเข้าล่าสุด ${fmtDateTime(x.usage.lastSyncedAt)}` : " · ยังไม่มีรายการ"}` : "ยังไม่เชื่อมกับข้อมูลระบบจอง"}</td></tr>
                ))}</tbody>
              </table></div>
            )}
            <p className="k-hint">ระบบไม่สร้างยอดสมมติ — ตัวเลขการใช้โค้ดมาจากรายการจองที่นำเข้าและผูกกับโปรโมชันที่มีโค้ดเดียวกันเท่านั้น</p>
          </section>
        </div>

        <div className="k-stack">
          <section className="k-card" aria-labelledby="h-visit">
            <div className="k-card-h"><h2 id="h-visit"><CalendarDays aria-hidden="true" />นัดหมายเข้าใช้บริการ</h2><span className="k-tag">{VISIT_LABEL[p.visitStatus]}</span></div>
            {edit ? (
              <ActionForm action={updateVisit} submitLabel="บันทึกนัดหมาย" submitClass="k-btn primary">
                <input type="hidden" name="participant_id" value={p.id} />
                <div className="k-form-grid cols2">
                  <label className="k-field"><span className="k-label">วันเข้าใช้บริการ</span><input className="k-input" type="date" name="visit_date" defaultValue={p.visitDate ?? ""} /></label>
                  <label className="k-field"><span className="k-label">เวลา</span><input className="k-input" type="time" name="visit_time" defaultValue={p.visitTime ?? ""} step={300} /></label>
                  <label className="k-field"><span className="k-label">สถานะการนัดหมาย</span>
                    <select className="k-select" name="visit_status" defaultValue={p.visitStatus}>{VISIT_STATUSES.map((s) => <option key={s} value={s}>{VISIT_LABEL[s]}</option>)}</select></label>
                  <label className="k-field"><span className="k-label">ความต้องการใช้โค้ช</span>
                    <select className="k-select" name="coach" defaultValue={p.coachRequired === null ? "" : p.coachRequired ? "yes" : "no"}>
                      <option value="">ไม่ระบุ</option><option value="no">ไม่ต้องการโค้ช</option><option value="yes">ต้องการโค้ช (ชำระเอง)</option></select></label>
                </div>
              </ActionForm>
            ) : <p>{p.visitDate ? `${fmtDate(p.visitDate)} ${p.visitTime ?? ""}` : "ยังไม่นัด"} · โค้ช: {p.coachRequired === null ? "ไม่ระบุ" : p.coachRequired ? "ต้องการ" : "ไม่ต้องการ"}</p>}
          </section>

          <section className="k-card" aria-labelledby="h-credit">
            <div className="k-card-h"><h2 id="h-credit"><Coins aria-hidden="true" />เครดิตคอร์ท</h2></div>
            <div className="k-stats">
              <div className="k-stat"><b>{cr.entitled}</b><span>ชม. ตามสิทธิ์{cr.entitledValueSatang ? ` (${baht(cr.entitledValueSatang)})` : ""}</span></div>
              <div className="k-stat"><b>{cr.used}</b><span>ชม. ที่ใช้แล้ว</span></div>
              <div className="k-stat"><b>{cr.remaining}</b><span>ชม. คงเหลือ</span></div>
            </div>
            <div style={{ marginTop: 10 }}><Note tone="warn">ข้อมูลติดตามภายใน — ยังไม่ได้เชื่อมระบบจองสนาม ระบบนี้ไม่ได้หักเครดิตหรือสร้างการจองจริง กรุณาจองในระบบจองตามปกติ</Note></div>
            {p.credits.length > 0 && (
              <div className="k-table-wrap" style={{ marginTop: 10 }}><table className="k-table">
                <thead><tr><th>วันที่</th><th>รายการ</th><th>ชม.</th><th>บันทึกโดย</th></tr></thead>
                <tbody>{p.credits.map((c) => (
                  <tr key={c.id}><td>{fmtDate(c.occurredOn)}</td><td>{{ entitlement: "สิทธิ์ตามแคมเปญ", usage: "ใช้เครดิต", adjustment: "ปรับเครดิต" }[c.kind]}{c.bookingRef ? ` · อ้างอิง ${c.bookingRef}` : ""}{c.note ? ` · ${c.note}` : ""}</td>
                    <td className="num">{c.kind === "usage" ? `−${c.hours}` : c.hours > 0 ? `+${c.hours}` : c.hours}</td><td>{c.byName ?? "ระบบ"}</td></tr>
                ))}</tbody>
              </table></div>
            )}
            {edit && (
              <details style={{ marginTop: 10 }}>
                <summary className="k-btn sm soft" style={{ listStyle: "none" }}>บันทึกการใช้เครดิต</summary>
                <ActionForm action={addCreditEntry} submitLabel="บันทึก (ติดตามภายใน)" submitClass="k-btn sm primary" resetOnOk>
                  <input type="hidden" name="participant_id" value={p.id} />
                  <div className="k-form-grid cols2" style={{ marginTop: 10 }}>
                    <label className="k-field"><span className="k-label">ประเภท</span><select className="k-select" name="kind" defaultValue="usage"><option value="usage">ใช้เครดิต</option><option value="adjustment">ปรับเครดิต (+/−)</option></select></label>
                    <label className="k-field"><span className="k-label">จำนวนชั่วโมง</span><input className="k-input" name="hours" inputMode="decimal" placeholder="เช่น 2 หรือ 1.5" /></label>
                    <label className="k-field"><span className="k-label">วันที่ใช้</span><input className="k-input" type="date" name="occurred_on" defaultValue={today} /></label>
                    <label className="k-field"><span className="k-label">เลขอ้างอิงการจอง (ถ้ามี)</span><input className="k-input" name="booking_ref" maxLength={80} /></label>
                    <label className="k-field span2"><span className="k-label">หมายเหตุ</span><input className="k-input" name="note" maxLength={500} /></label>
                  </div>
                </ActionForm>
              </details>
            )}
          </section>

          <section className="k-card" aria-labelledby="h-promo">
            <div className="k-card-h"><h2 id="h-promo"><BadgePercent aria-hidden="true" />Promo Code</h2></div>
            {p.promos.map((x) => (
              <div key={x.id} className="k-deliv">
                <div className="k-row between"><b style={{ fontSize: 17, letterSpacing: ".04em" }}>{x.code}</b>
                  <span className="k-badge" data-tone={x.status === "active" ? "green" : "gray"}>{x.status === "active" ? "ใช้งาน" : "ยกเลิกแล้ว"}</span></div>
                <span className="k-small k-muted">ส่วนลด {x.discountBps / 100}%{x.maxUses ? ` · ใช้ได้ ${x.maxUses} ครั้ง` : ""}{x.validUntil ? ` · ถึง ${fmtDate(x.validUntil)}` : ""}</span>
                <div className="k-actions"><CopyButton text={x.code} label="คัดลอกโค้ด" />
                  {edit && x.status === "active" && <ActionForm action={voidPromoCode} submitLabel="ยกเลิกโค้ด" submitClass="k-btn sm ghost" inline><input type="hidden" name="promo_id" value={x.id} /></ActionForm>}</div>
                {!x.usage.linked && <span className="k-source"><Info aria-hidden="true" />ยังไม่เชื่อมระบบจอง — สร้างโค้ดเดียวกันในระบบจอง แล้วนำเข้าข้อมูลการจองเพื่อดูยอดใช้</span>}
              </div>
            ))}
            {edit && (
              <ActionForm action={createPromoCode} submitLabel="บันทึกโค้ด" submitClass="k-btn sm primary" resetOnOk>
                <input type="hidden" name="participant_id" value={p.id} />
                <div className="k-form-grid cols2" style={{ marginTop: p.promos.length ? 10 : 0 }}>
                  <label className="k-field"><span className="k-label">รหัส Promo Code</span>
                    <input className="k-input" name="code" defaultValue={suggestPromoCode(membership || p.creatorName, terms?.promoDiscountBps ?? 3000)} autoCapitalize="characters" maxLength={40} /></label>
                  <label className="k-field"><span className="k-label">ส่วนลด (%)</span><input className="k-input" name="discount_pct" inputMode="decimal" defaultValue={(terms?.promoDiscountBps ?? 3000) / 100} /></label>
                  <label className="k-field"><span className="k-label">จำนวนครั้งที่ใช้ได้</span><input className="k-input" name="max_uses" inputMode="numeric" defaultValue={terms?.promoMaxUses ?? ""} /></label>
                  <label className="k-field"><span className="k-label">ใช้ได้ถึง</span><input className="k-input" type="date" name="valid_until" defaultValue={terms?.promoValidDays ? addDays(today, terms.promoValidDays) : ""} /></label>
                </div>
                <p className="k-hint">บันทึกโค้ดในระบบนี้เพื่อติดตาม — ไม่ได้สร้างโค้ดในระบบจองให้อัตโนมัติ</p>
              </ActionForm>
            )}
          </section>

          <section className="k-card" aria-labelledby="h-pnotes">
            <div className="k-card-h"><h2 id="h-pnotes"><NotebookPen aria-hidden="true" />สถานะและหมายเหตุ</h2></div>
            {edit ? (
              <ActionForm action={updateParticipant} submitLabel="บันทึก" submitClass="k-btn sm primary">
                <input type="hidden" name="participant_id" value={p.id} />
                <label className="k-field"><span className="k-label">สถานะใน Campaign</span>
                  <select className="k-select" name="status" defaultValue={p.status}><option value="active">กำลังดำเนินการ</option><option value="completed">จบแคมเปญ</option><option value="cancelled">ยกเลิก</option></select></label>
                <label className="k-field"><span className="k-label">Notes</span><textarea className="k-textarea" name="notes" defaultValue={p.notes ?? ""} maxLength={4000} /></label>
              </ActionForm>
            ) : <p style={{ whiteSpace: "pre-line" }}>{p.notes || "–"}</p>}
          </section>
        </div>
      </div>
    </>
  );
}
