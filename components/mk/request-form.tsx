"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlarmClock, Bell, CalendarDays, Car, Check, ChevronRight, CircleAlert, Clock, FileText, Flag, Hash, Image as ImageIcon, Info,
  Link as LinkIcon, MessageCircle, Navigation, Paperclip, Plus, Repeat, TriangleAlert, Users, Video, X,
} from "lucide-react";
import { saveRequest } from "@/app/(mk)/mk/actions";
import type { FormState } from "@/app/actions";
import {
  CALENDAR_LISTS, KIND_SHORT, MK_KINDS, PLATFORMS, PLATFORM_LABEL, PRIORITY_OPTIONS, REMIND_BEFORE_OPTIONS, REPEAT_OPTIONS, TRAVEL_OPTIONS, type MkKind,
} from "@/lib/mk-core";

type F = Record<string, string>;
const CHANNELS = ["Meta Ads", "Facebook", "Instagram", "TikTok", "YouTube", "LINE OA", "Google Ads", "ป้าย / สื่อสิ่งพิมพ์", "หน้าคอร์ท"];
const TAG_SUGGEST = ["#แอดTikTok", "#คลาสผู้ใหญ่", "#คลาสเด็ก", "#โปรโมชัน", "#อินฟลูเอนเซอร์", "#งานแข่ง", "#คอร์ทกลางคืน", "#สมาชิกใหม่"];
const count = (f: F, prefix: string, min: number) => {
  let n = 0;
  for (let i = 0; i < 20; i++) if ((f[`${prefix}.${i}`] ?? "").trim()) n = i + 1;
  return Math.max(n, min);
};

function Sw({ name, label, on, onChange, sub, icon }: { name: string; label: string; on: boolean; onChange?: (v: boolean) => void; sub?: string; icon: React.ReactNode }) {
  const id = `sw-${name}`;
  return (
    <div className="ap-frow">
      <span className="ap-frow-ic">{icon}</span>
      <span className="ap-frow-in">
        <label htmlFor={id}>{label}{sub && <small>{sub}</small>}</label>
        <span className="ap-sw"><input id={id} type="checkbox" role="switch" name={name} defaultChecked={on} onChange={(e) => onChange?.(e.target.checked)} /><span aria-hidden="true" /></span>
      </span>
    </div>
  );
}

function Sel({ name, label, icon, value, options, sq }: { name: string; label: string; icon: React.ReactNode; value: string; options: readonly { value: string | number; label: string }[]; sq?: boolean }) {
  const id = `sel-${name}`;
  return (
    <div className="ap-frow">
      <span className={`ap-frow-ic${sq ? " sq" : ""}`}>{icon}</span>
      <span className="ap-frow-in">
        <label htmlFor={id}>{label}</label>
        <select id={id} name={name} defaultValue={value}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      </span>
    </div>
  );
}

function Cap({ name, label, value, ph, req, prefix, type = "text", inputMode, list, invalid, hint, auto }: {
  name: string; label: string; value?: string; ph?: string; req?: boolean; prefix?: string; type?: string; inputMode?: "decimal" | "numeric" | "url";
  list?: string; invalid?: boolean; hint?: string; auto?: string;
}) {
  return (
    <div className="ap-fld"><div>
      <label htmlFor={`f-${name}`}>{label}{req && <i> (จำเป็น)</i>}</label>
      <span className="ap-cap" aria-invalid={invalid || undefined}>
        {prefix && <span>{prefix}</span>}
        <input id={`f-${name}`} name={name} type={type} defaultValue={value} placeholder={ph} required={req} inputMode={inputMode} list={list}
          autoComplete={auto ?? "off"} aria-invalid={invalid || undefined} aria-describedby={hint ? `h-${name}` : undefined} />
      </span>
      {hint && <p id={`h-${name}`} className="ap-note" style={{ marginLeft: 6 }}>{hint}</p>}
    </div></div>
  );
}

function Area({ name, label, value, ph, req, sm, invalid }: { name: string; label: string; value?: string; ph?: string; req?: boolean; sm?: boolean; invalid?: boolean }) {
  return (
    <div className="ap-fld"><div>
      <label htmlFor={`f-${name}`}>{label}{req && <i> (จำเป็น)</i>}</label>
      <textarea id={`f-${name}`} name={name} className={`ap-area${sm ? " sm" : ""}`} defaultValue={value} placeholder={ph} required={req} rows={sm ? 2 : 3} aria-invalid={invalid || undefined} />
    </div></div>
  );
}

function DateRow({ label, req, date, time, tint, invalid }: {
  label: string; req?: boolean; tint?: boolean; invalid?: boolean;
  date: { name: string; value?: string }; time?: { name: string; value?: string; hidden?: boolean };
}) {
  return (
    <div className={`ap-fld${tint ? " ap-tint" : ""}`}><div>
      <span className="lab" id={`l-${date.name}`}>{label}{req && <i> (จำเป็น)</i>}</span>
      <span className="ap-cap" aria-invalid={invalid || undefined} style={{ marginTop: 8 }}>
        <input name={date.name} type="date" defaultValue={date.value} required={req} aria-labelledby={`l-${date.name}`} aria-invalid={invalid || undefined} id={`f-${date.name}`} />
        <CalendarDays aria-hidden="true" />
      </span>
      {time && !time.hidden && (
        <span className="ap-cap" style={{ marginTop: 8 }}>
          <input name={time.name} type="time" defaultValue={time.value} aria-label={`${label} เวลา`} id={`f-${time.name}`} />
          <Clock aria-hidden="true" />
        </span>
      )}
    </div></div>
  );
}

function Body({ f, kindInit, people0, att0, isEdit }: { f: F; kindInit: MkKind; people0: number; att0: number; isEdit: boolean }) {
  const [kind, setKind] = useState<MkKind>(kindInit);
  const [allDay, setAllDay] = useState(f.all_day === "on" || (!f.start_time && !!f.starts_on) || !f.starts_on);
  const [remind, setRemind] = useState(f.remind === "on");
  const [people, setPeople] = useState(people0);
  const [att, setAtt] = useState(att0);
  const [attKinds, setAttKinds] = useState<Record<number, string>>({});
  const [tags, setTags] = useState<string[]>((f.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean));
  const [newTag, setNewTag] = useState("");
  const more = useRef<HTMLDetailsElement>(null);
  const bad = (n: string) => f.$field === n;
  const addAtt = (k: "file" | "image" | "link") => {
    setAttKinds((m) => ({ ...m, [att]: k }));
    setAtt((n) => Math.min(12, n + 1));
    setTimeout(() => document.getElementById(`f-att_url.${att}`)?.focus(), 0);
  };
  const toggleTag = (t: string) => setTags((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t].slice(0, 12)));
  const addTag = () => {
    const t = newTag.trim().replace(/^#?/, "#").replace(/\s+/g, "");
    if (t.length > 1 && t.length <= 40) { setTags((xs) => (xs.includes(t) ? xs : [...xs, t].slice(0, 12))); setNewTag(""); }
  };
  const tagOptions = [...new Set([...TAG_SUGGEST, ...tags])];

  return (
    <>
      {isEdit && <input type="hidden" name="id" value={f.id} />}
      <div className="ap-fseg" role="radiogroup" aria-label="ประเภทคำขอ">
        {MK_KINDS.map((k) => (
          <label key={k}>
            <input type="radio" name="kind" value={k} defaultChecked={k === kindInit} onChange={() => setKind(k)} />
            <span>{KIND_SHORT[k]}</span>
          </label>
        ))}
      </div>

      <section className="ap-grp" aria-labelledby="g1"><h2 id="g1">ข้อมูลหลัก</h2>
        <div className="ap-grp-card">
          <Cap name="title" label="ชื่อคำขอ" value={f.title} req invalid={bad("title")} ph={kind === "influencer" ? "เช่น คัดเลือกอินฟลูเอนเซอร์รีวิวคอร์ทกลางคืน" : "เช่น ยิงแอด TikTok คลาสเทนนิสผู้ใหญ่มือใหม่"} />
          <Area name="summary" label="สิ่งที่ขออนุมัติ" value={f.summary} req invalid={bad("summary")} ph="สรุปสั้น ๆ ว่าต้องการให้อนุมัติอะไร" />
          <Cap name="amount" label={kind === "influencer" ? "ค่าจ้างรวม (บาท) · เว้นว่างเพื่อรวมจากรายคน" : "งบประมาณ (บาท)"} value={f.amount} prefix="฿" inputMode="decimal" ph="0" invalid={bad("amount")} />
          <Cap name="channel" label="ช่องทาง" value={f.channel} list="ap-channels" ph="เช่น TikTok, Meta Ads" />
          <datalist id="ap-channels">{CHANNELS.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
      </section>

      <section className="ap-grp" aria-labelledby="g-kind"><h2 id="g-kind">{kind === "ad" ? "รายละเอียดแอด" : kind === "promotion" ? "รายละเอียดโปรโมชัน" : kind === "influencer" ? "อินฟลูเอนเซอร์" : "รายละเอียด"}</h2>
        <div className="ap-grp-card">
          {kind === "promotion" && <Cap name="discount_text" label="ส่วนลด / ข้อเสนอ" value={f.discount_text} ph="เช่น ลด 20%" />}
          <Area name="goal" label="เป้าหมาย" value={f.goal} sm ph="ต้องการผลลัพธ์อะไร กลุ่มเป้าหมายคือใคร" />
          {kind === "ad" && <Area name="ad_copy" label="ข้อความแอด" value={f.ad_copy} sm ph="ข้อความที่จะใช้ในแอด" />}
          {kind !== "promotion" && <Area name="plan" label={kind === "ad" ? "แผนยิงแอด" : "แผนงาน"} value={f.plan} sm ph={kind === "ad" ? "เช่น 15–21 พ.ย. สร้างการรับรู้ ฿6,000" : "ขั้นตอนหรือช่วงเวลา"} />}
          {(kind === "promotion" || kind === "other") && <Area name="conditions" label="เงื่อนไข" value={f.conditions} sm ph="เงื่อนไขการใช้ หรือข้อจำกัด" />}
        </div>
        {kind === "influencer" && (
          <>
            {Array.from({ length: people }, (_, i) => (
              <div key={i} className="ap-person" role="group" aria-label={`อินฟลูเอนเซอร์คนที่ ${i + 1}`}>
                <div className="ap-person-head"><b>คนที่ {i + 1}</b>
                  {people > 1 && i === people - 1 && <button type="button" className="ap-ibtn ghost" aria-label={`ลบคนที่ ${i + 1}`} onClick={() => setPeople((n) => n - 1)}><X aria-hidden="true" /></button>}
                </div>
                <Cap name={`p_name.${i}`} label="ชื่อ" value={f[`p_name.${i}`]} req={i === 0} invalid={bad(`p_name.${i}`)} ph="เช่น ครูแนน · Tennis Diary" />
                <div className="ap-person-grid">
                  <div className="ap-fld" style={{ padding: 0 }}><div>
                    <label htmlFor={`f-p_platform.${i}`}>แพลตฟอร์ม</label>
                    <span className="ap-cap"><select id={`f-p_platform.${i}`} name={`p_platform.${i}`} defaultValue={f[`p_platform.${i}`] ?? "tiktok"}>
                      {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}</select></span>
                  </div></div>
                  <Cap name={`p_handle.${i}`} label="บัญชี" value={f[`p_handle.${i}`]} ph="@handle" />
                  <Cap name={`p_followers.${i}`} label="ผู้ติดตาม" value={f[`p_followers.${i}`]} inputMode="numeric" ph="125000" />
                  <Cap name={`p_fee.${i}`} label="ค่าจ้าง (บาท)" value={f[`p_fee.${i}`]} prefix="฿" inputMode="decimal" ph="0" />
                  <Cap name={`p_views.${i}`} label="วิวเฉลี่ย" value={f[`p_views.${i}`]} inputMode="numeric" ph="62000" />
                  <Cap name={`p_eng.${i}`} label="การมีส่วนร่วม %" value={f[`p_eng.${i}`]} inputMode="decimal" ph="5.8" />
                </div>
                <Cap name={`p_audience.${i}`} label="ผู้ชมหลัก" value={f[`p_audience.${i}`]} ph="เช่น ผู้หญิง 25–34 ปี กรุงเทพฯ" />
                <Cap name={`p_deliver.${i}`} label="ชิ้นงาน" value={f[`p_deliver.${i}`]} ph="เช่น 2 คลิป TikTok 60 วินาที" />
                <DateRow label="วันส่งงาน" date={{ name: `p_deliver_by.${i}`, value: f[`p_deliver_by.${i}`] }} />
                <Area name={`p_cond.${i}`} label="เงื่อนไข" value={f[`p_cond.${i}`]} sm ph="เช่น แก้ไขได้ 1 ครั้ง" />
                <Area name={`p_fit.${i}`} label="ความเหมาะสมกับแคมเปญ" value={f[`p_fit.${i}`]} sm />
                <Cap name={`p_profile.${i}`} label="ลิงก์โปรไฟล์" value={f[`p_profile.${i}`]} type="url" inputMode="url" ph="https://" />
                <Cap name={`p_photo.${i}`} label="ลิงก์ภาพโปรไฟล์" value={f[`p_photo.${i}`]} type="url" inputMode="url" ph="https://" />
              </div>
            ))}
            {people < 20 && <button type="button" className="ap-btn white ap-add" onClick={() => setPeople((n) => n + 1)}><Plus aria-hidden="true" />เพิ่มอินฟลูเอนเซอร์</button>}
          </>
        )}
      </section>

      <section className="ap-grp" aria-labelledby="g2"><h2 id="g2">เวลาและนัดหมาย</h2>
        <div className="ap-grp-card">
          <Sw name="all_day" label="ทั้งวัน" on={allDay} onChange={setAllDay} icon={<Clock aria-hidden="true" />} />
          <DateRow label="เริ่ม" date={{ name: "starts_on", value: f.starts_on }} time={{ name: "start_time", value: f.start_time, hidden: allDay }} invalid={bad("starts_on") || bad("start_time")} />
          <DateRow label="สิ้นสุด" date={{ name: "ends_on", value: f.ends_on }} time={{ name: "end_time", value: f.end_time, hidden: allDay }} invalid={bad("ends_on") || bad("end_time")} />
          <DateRow label="กำหนดตัดสินใจ" req date={{ name: "decide_by", value: f.decide_by }} invalid={bad("decide_by")} />
          <Sel name="travel_minutes" label="เวลาเดินทาง" icon={<Car aria-hidden="true" />} value={f.travel_minutes ?? "0"} options={TRAVEL_OPTIONS} />
          <Sel name="calendar_list" label="ปฏิทิน" icon={<CalendarDays aria-hidden="true" />} value={f.calendar_list ?? "marketing"} options={CALENDAR_LISTS} />
          <div className="ap-frow">
            <span className="ap-frow-ic"><Users aria-hidden="true" /></span>
            <span className="ap-frow-in">
              <label htmlFor="f-invitees">ผู้รับเชิญ</label>
              <input id="f-invitees" name="invitees" defaultValue={f.invitees} placeholder="ไม่มี" autoComplete="off"
                style={{ border: 0, background: "transparent", textAlign: "right", fontSize: 15, color: "var(--ap-muted)", minWidth: 0, flex: "1 1 auto", height: 44 }} />
            </span>
          </div>
          <Sw name="urgent" label="ฉุกเฉิน" on={f.urgent === "on"} icon={<AlarmClock aria-hidden="true" />} />
        </div>
        <p>เปิด “ฉุกเฉิน” เมื่อต้องการให้คำขอนี้ขึ้นเป็นเรื่องด่วนบนหน้ารวม MK</p>
      </section>

      <section className="ap-grp" aria-labelledby="g3"><h2 id="g3">ทำซ้ำและแจ้งเตือน</h2>
        <div className="ap-grp-card">
          <Sw name="remind" label="ตั้งเตือน" on={remind} onChange={setRemind} icon={<Bell aria-hidden="true" />} />
          {remind && <DateRow label="วันและเวลาที่เตือน" tint date={{ name: "remind_on", value: f.remind_on }} time={{ name: "remind_time", value: f.remind_time }} invalid={bad("remind_on")} />}
          <Sel name="repeat" label="ทำประจำ" icon={<Repeat aria-hidden="true" />} value={f.repeat ?? "none"} options={REPEAT_OPTIONS} />
        </div>
        <p>เปิด “ตั้งเตือน” แล้วจึงแสดงวันและเวลา · เตือนล่วงหน้า สถานที่ และเมื่อส่งข้อความอยู่ใน “รายละเอียดเพิ่มเติม”</p>
      </section>

      <section className="ap-grp" aria-labelledby="g4"><h2 id="g4">ข้อมูลประกอบ</h2>
        <div className="ap-grp-card">
          <div style={{ padding: "12px 16px 14px" }}>
            <div className="ap-shortcuts">
              <button type="button" onClick={() => addAtt("file")}><Paperclip aria-hidden="true" />แนบไฟล์</button>
              <button type="button" onClick={() => addAtt("image")}><ImageIcon aria-hidden="true" />ภาพ</button>
              <button type="button" onClick={() => addAtt("link")}><LinkIcon aria-hidden="true" />ลิงก์</button>
              <button type="button" onClick={() => { if (more.current) more.current.open = true; setTimeout(() => document.getElementById("f-newtag")?.focus(), 0); }}><Hash aria-hidden="true" />แท็ก</button>
            </div>
            {Array.from({ length: att }, (_, i) => {
              const k = attKinds[i] ?? f[`att_kind.${i}`] ?? "file";
              return (
                <div key={i} className="ap-attach">
                  <span style={{ color: "var(--ap-muted)", display: "flex" }}>{k === "image" ? <ImageIcon aria-hidden="true" style={{ width: 18 }} /> : k === "link" ? <LinkIcon aria-hidden="true" style={{ width: 18 }} /> : <FileText aria-hidden="true" style={{ width: 18 }} />}</span>
                  <select name={`att_kind.${i}`} defaultValue={k} aria-label={`ชนิดไฟล์แนบที่ ${i + 1}`} onChange={(e) => setAttKinds((m) => ({ ...m, [i]: e.target.value }))}>
                    <option value="file">ไฟล์</option><option value="image">ภาพ</option><option value="link">ลิงก์</option>
                  </select>
                  <input id={`f-att_url.${i}`} name={`att_url.${i}`} type="url" inputMode="url" defaultValue={f[`att_url.${i}`]} placeholder="https://… (ลิงก์ไฟล์ เช่น Google Drive)" aria-label={`ลิงก์ไฟล์แนบที่ ${i + 1}`} aria-invalid={bad(`att_url.${i}`) || undefined} />
                  <input name={`att_label.${i}`} defaultValue={f[`att_label.${i}`]} placeholder="ชื่อ" aria-label={`ชื่อไฟล์แนบที่ ${i + 1}`} style={{ maxWidth: 96 }} />
                  {i === att - 1 && <button type="button" className="ap-ibtn ghost" aria-label={`ลบไฟล์แนบที่ ${i + 1}`} onClick={() => setAtt((n) => n - 1)}><X aria-hidden="true" /></button>}
                </div>
              );
            })}
            {att > 0 && <p className="ap-note" style={{ marginLeft: 6 }}>วางลิงก์ที่ขึ้นต้นด้วย https:// ภาพจะแสดงเป็นพรีวิวให้ผู้อนุมัติ</p>}
          </div>
          <Cap name="link_url" label="URL" value={f.link_url} type="url" inputMode="url" ph="https://" invalid={bad("link_url")} />
          <Area name="note" label="โน้ต" value={f.note} sm ph="ข้อมูลเพิ่มเติมสำหรับผู้อนุมัติ" />
        </div>
      </section>

      <section className="ap-grp" aria-labelledby="g5"><h2 id="g5">ตัวเลือกเพิ่มเติม</h2>
        <div className="ap-grp-card">
          <details ref={more} className="ap-more">
            <summary className="ap-frow">
              <span className="ap-frow-ic"><Info aria-hidden="true" /></span>
              <span className="ap-frow-in"><span>รายละเอียดเพิ่มเติม</span><span className="val">{tags.length ? `${tags.length} แท็ก` : ""}<ChevronRight className="chev" aria-hidden="true" /></span></span>
            </summary>
            <div className="ap-more-body">
              <Sel name="remind_before" label="เตือนล่วงหน้า" icon={<Bell aria-hidden="true" />} value={f.remind_before ?? "none"} options={REMIND_BEFORE_OPTIONS} />
              <div className="ap-frow"><span className="ap-frow-ic"><Hash aria-hidden="true" /></span><span className="ap-frow-in"><span id="l-tags">แท็ก</span><span className="val">{tags.length ? tags.join(" ") : "ไม่มี"}</span></span></div>
              <input type="hidden" name="tags" value={tags.join(",")} />
              <div className="ap-tagpick" role="group" aria-labelledby="l-tags">
                {tagOptions.map((t) => (
                  <label key={t}><input type="checkbox" checked={tags.includes(t)} onChange={() => toggleTag(t)} /><span>{tags.includes(t) && <Check aria-hidden="true" style={{ width: 15, height: 15 }} />}{t}</span></label>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, padding: "0 16px 14px" }}>
                <span className="ap-cap" style={{ flex: "1 1 auto", marginTop: 0 }}>
                  <input id="f-newtag" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="เพิ่มแท็กใหม่" aria-label="เพิ่มแท็กใหม่"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                </span>
                <button type="button" className="ap-btn h48" style={{ flex: "0 0 auto" }} onClick={addTag}>เพิ่ม</button>
              </div>
              <Sw name="flagged" label="ติดธง" on={f.flagged === "on"} icon={<Flag aria-hidden="true" />} />
              <Sel name="priority" label="ความสำคัญ" icon={<TriangleAlert aria-hidden="true" />} value={f.priority ?? "normal"} options={PRIORITY_OPTIONS} />
              <Sw name="remind_location" label="เตือนตามสถานที่" sub="เช่น เมื่อมาถึงคอร์ท" on={f.remind_location === "on"} icon={<Navigation aria-hidden="true" />} />
              <Sw name="remind_messaging" label="เมื่อส่งข้อความ" sub="เตือนเมื่อเริ่มแชตกับคนที่เลือก" on={f.remind_messaging === "on"} icon={<MessageCircle aria-hidden="true" />} />
              <button type="button" className="ap-frow" style={{ width: "100%", border: 0, background: "transparent", textAlign: "left", cursor: "pointer", color: "inherit" }} onClick={() => addAtt("image")}>
                <span className="ap-frow-ic"><Video aria-hidden="true" /></span><span className="ap-frow-in"><span>เพิ่มภาพ…</span><ChevronRight aria-hidden="true" style={{ width: 16, color: "var(--ap-muted)" }} /></span>
              </button>
            </div>
          </details>
        </div>
      </section>
    </>
  );
}

/** Team form (clip V01 functions). Values survive a failed save; the ✓ button is the only submit and cannot double-send. */
export function RequestForm({ initial, isEdit, cancelHref }: { initial: F; isEdit: boolean; cancelHref: string }) {
  const [state, act, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await saveRequest(prev, fd);
    return { ...r, nonce: String(Date.now()) };
  }, {} as FormState);
  const f = state.fields ?? initial;
  const kind0 = (MK_KINDS as string[]).includes(f.kind) ? (f.kind as MkKind) : "ad";
  const [dirty, setDirty] = useState(false);
  const [ask, setAsk] = useState(false);
  const errRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.error) return;
    const el = state.fields?.$field ? document.getElementById(`f-${state.fields.$field}`) : null;
    (el ?? errRef.current)?.focus();
  }, [state]);

  return (
    <form action={act} className="ap-form" onInput={() => setDirty(true)} noValidate aria-busy={pending}>
      <div className="ap-fhead">
        <div className="ap-col">
          {dirty
            ? <button type="button" className="ap-ibtn white" aria-label="ปิดฟอร์ม" onClick={() => setAsk(true)}><X aria-hidden="true" strokeWidth={1.8} /></button>
            : <Link href={cancelHref} className="ap-ibtn white" aria-label="ปิดฟอร์ม"><X aria-hidden="true" strokeWidth={1.8} /></Link>}
          <h1>{isEdit ? "แก้ไขคำขอ" : "คำขอใหม่"}</h1>
          <button type="submit" className="ap-ibtn primary" aria-label={pending ? "กำลังส่งคำขอ" : isEdit ? "บันทึกและส่งอนุมัติ" : "ส่งคำขอ"} disabled={pending}>
            <Check aria-hidden="true" strokeWidth={2.4} />
          </button>
        </div>
      </div>
      <div className="ap-col">
        {state.error && !pending && (
          <div ref={errRef} tabIndex={-1} role="alert" className="ap-alert ap-ferr"><CircleAlert aria-hidden="true" />{state.error}</div>
        )}
        {pending && <div role="status" className="ap-ok ap-ferr" style={{ background: "var(--ap-surf)", color: "var(--ap-ink2)" }}>กำลังส่งคำขอ…</div>}
        <Body key={state.nonce ?? "init"} f={f} kindInit={kind0} isEdit={isEdit}
          people0={count(f, "p_name", 1)} att0={count(f, "att_url", 0)} />
        <button type="submit" className="ap-btn primary block h56" style={{ marginTop: 28 }} disabled={pending}>
          {pending ? "กำลังส่ง…" : isEdit ? "บันทึกและส่งอนุมัติ" : "ส่งคำขอ"}
        </button>
      </div>
      {ask && (
        <>
          <div className="ap-dialog-veil" onClick={() => setAsk(false)} aria-hidden="true" />
          <section className="ap-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dc-t" aria-describedby="dc-d">
            <h2 id="dc-t">{isEdit ? "ทิ้งการแก้ไขนี้หรือไม่" : "ทิ้งคำขอใหม่นี้หรือไม่"}</h2>
            <p id="dc-d">ข้อมูลที่กรอกไว้ยังไม่ได้ส่ง และจะหายไปเมื่อทิ้ง</p>
            <div className="ap-stack">
              <Link href={cancelHref} className="ap-btn danger block h48">ทิ้งการแก้ไข</Link>
              <button type="button" className="ap-btn block h48" autoFocus onClick={() => setAsk(false)}>แก้ไขต่อ</button>
            </div>
          </section>
        </>
      )}
    </form>
  );
}
