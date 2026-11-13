/* eslint-disable @next/next/no-img-element -- images come from Postgres through our own routes (/api/kol/files, /api/public/hero) or local blob previews; next/image would need a custom loader */
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, AlignLeft, ArrowDown, ArrowUp, Calendar, CheckCircle2, CircleDot, Clock, Cloud, CloudOff, Copy, Eye, FileUp, GripVertical, Hash, ImagePlus,
  Link2, ListChecks, ListOrdered, Loader2, Mail, Phone, Plus, RotateCcw, Rocket, Save, Settings2, ShieldCheck, SquareCheckBig, Trash2, Type, X, ChevronDown,
} from "lucide-react";
import {
  CHOICE_TYPES, FIELD_TYPES, FIELD_TYPE_LABEL, MAPPINGS, PURPOSE_LABEL, REQUIRED_MAPPINGS, SOCIAL_PRESETS, SOCIAL_MAP_RE, PLATFORM_RE, allFields, duplicateField,
  emptyField, isChoice, isFileType, mappingAllows, mappingLabel, newKey, typeChangeRisk,
  type Condition, type CondOp, type Field, type FieldType, type FormSchema, type Purpose, type SchemaIssue, type Section,
} from "@/lib/forms-core";
import { discardDraft, publishForm, saveFormDraft } from "@/app/(app)/kol/actions";
import { CopyButton } from "./client";

const ICON: Record<FieldType, React.ComponentType<{ "aria-hidden"?: boolean }>> = {
  short_text: Type, long_text: AlignLeft, number: Hash, phone: Phone, email: Mail, url: Link2, single_choice: CircleDot, multiple_choice: ListChecks,
  dropdown: ListOrdered, date: Calendar, time: Clock, checkbox: SquareCheckBig, file: FileUp, image: ImagePlus, consent: ShieldCheck,
};
type Props = {
  formId: string; title: string; purpose: Purpose; status: "draft" | "published" | "closed"; versionNo: number | null; draft: FormSchema; rev: number;
  draftDirty: boolean; publishedTypes: Record<string, FieldType>; responses: number; publicUrl: string | null;
};
type Modal = { title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void } | null;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const OP_LABEL: Record<CondOp, string> = { equals: "เท่ากับ", not_equals: "ไม่เท่ากับ", includes: "มีตัวเลือก", not_includes: "ไม่มีตัวเลือก", not_empty: "มีคำตอบ", empty: "ไม่มีคำตอบ" };

export function FormEditor(p: Props) {
  const [schema, setSchema] = useState<FormSchema>(p.draft);
  const [title, setTitle] = useState(p.title);
  const [rev, setRev] = useState(p.rev);
  const [changes, setChanges] = useState(0);
  const [savedChanges, setSavedChanges] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; conflict?: boolean } | null>(null);
  const [issues, setIssues] = useState<SchemaIssue[]>([]);
  const [published, setPublished] = useState({ versionNo: p.versionNo, dirty: p.draftDirty, status: p.status, just: false });
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [tab, setTab] = useState<"questions" | "settings">("questions");
  const [addFor, setAddFor] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ key: string | null; over: string | null; sec: string | null }>({ key: null, over: null, sec: null });
  const [modal, setModal] = useState<Modal>(null);
  const [publishing, setPublishing] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const inflight = useRef(false);
  const latest = useRef({ schema, title, rev, changes });
  useEffect(() => { latest.current = { schema, title, rev: Math.max(rev, latest.current.rev), changes }; }, [schema, title, rev, changes]);
  const dirty = changes !== savedChanges;

  useEffect(() => { if (modal) dlg.current?.showModal(); else dlg.current?.close(); }, [modal]);
  const ask = (m: NonNullable<Modal>) => setModal(m);

  const edit = useCallback((fn: (s: FormSchema) => void) => {
    setSchema((s) => { const n = clone(s); fn(n); return n; });
    setChanges((c) => c + 1);
    setIssues([]);
  }, []);

  const save = useCallback(async (): Promise<number | null> => {
    if (inflight.current) return null;
    inflight.current = true;
    setSaving(true);
    const snap = latest.current;
    try {
      const r = await saveFormDraft(p.formId, snap.rev, snap.title, snap.schema);
      if (r.error) { setError({ text: r.error, conflict: r.conflict }); return null; }
      setRev(r.rev!); latest.current.rev = r.rev!;
      setSavedChanges(snap.changes); setSavedAt(r.savedAt ?? null); setError(null);
      setPublished((x) => ({ ...x, dirty: true, just: false }));
      return r.rev!;
    } catch { setError({ text: "บันทึกไม่สำเร็จ (เครือข่ายขัดข้อง) — การแก้ไขยังอยู่ในหน้านี้ กด Save Draft อีกครั้ง หรือระบบจะลองใหม่เมื่อแก้ไขครั้งถัดไป" }); return null; }
    finally { inflight.current = false; setSaving(false); }
  }, [p.formId]);

  // Autosave 1.5 s after the last edit; unsaved changes also warn before leaving the page.
  useEffect(() => {
    if (!dirty || error?.conflict) return;
    const t = setTimeout(() => { void save(); }, 1500);
    return () => clearTimeout(t);
  }, [changes, savedChanges, dirty, save, error?.conflict, title]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (latest.current.changes !== savedChanges) { e.preventDefault(); } };
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); void save(); } };
    window.addEventListener("beforeunload", h); window.addEventListener("keydown", k);
    return () => { window.removeEventListener("beforeunload", h); window.removeEventListener("keydown", k); };
  }, [savedChanges, save]);

  async function publish() {
    setPublishing(true);
    try {
      let r = rev;
      if (dirty) { const n = await save(); if (n === null) return; r = n; }
      const res = await publishForm(p.formId, r);
      if (res.issues?.length) { setIssues(res.issues); setError({ text: res.error ?? "ยังเผยแพร่ไม่ได้" }); return; }
      if (res.error) { setError({ text: res.error, conflict: res.conflict }); return; }
      setIssues([]); setError(null);
      setPublished({ versionNo: res.versionNo!, dirty: false, status: "published", just: true });
    } finally { setPublishing(false); }
  }

  const fields = useMemo(() => allFields(schema), [schema]);
  const critical = new Set(REQUIRED_MAPPINGS[p.purpose]);
  const socialUrlCount = fields.filter((f) => f.mapsTo && /^social\..+\.url$/.test(f.mapsTo)).length;
  const isCritical = (f: Field) => !!f.mapsTo && (critical.has(f.mapsTo) || (p.purpose === "kol_application" && /^social\..+\.url$/.test(f.mapsTo) && socialUrlCount <= 1));

  // ------------------------------------------------------------ operations
  const findField = (s: FormSchema, key: string) => { for (const sec of s.sections) { const i = sec.fields.findIndex((f) => f.key === key); if (i >= 0) return { sec, i }; } return null; };
  const updateField = (key: string, patch: Partial<Field>) => edit((s) => { const h = findField(s, key); if (h) Object.assign(h.sec.fields[h.i], patch); });
  const removeFieldNow = (key: string) => edit((s) => {
    const h = findField(s, key); if (!h) return;
    h.sec.fields.splice(h.i, 1);
    for (const f of allFields(s)) if (f.showIf) { f.showIf = f.showIf.filter((c) => c.field !== key); if (!f.showIf.length) delete f.showIf; }
  });
  const removeField = (f: Field) => ask({
    title: `ลบคำถาม “${f.label || "ไม่มีชื่อ"}”?`, danger: true, confirmLabel: "ลบคำถาม",
    body: `${isCritical(f) ? `คำถามนี้ผูกกับ “${mappingLabel(f.mapsTo)}” ที่ Workflow ใช้สร้างการ์ด CEO — ต้องกำหนดคำถามอื่นแทนก่อนจึงจะเผยแพร่ได้ ` : ""}คำตอบเก่าในฐานข้อมูลไม่ถูกลบ (ยังดูได้ในเวอร์ชันเดิม)`,
    onConfirm: () => { removeFieldNow(f.key); if (openKey === f.key) setOpenKey(null); },
  });
  const moveField = (key: string, dir: -1 | 1) => edit((s) => {
    const h = findField(s, key); if (!h) return;
    const si = s.sections.indexOf(h.sec);
    const j = h.i + dir;
    if (j >= 0 && j < h.sec.fields.length) { const [f] = h.sec.fields.splice(h.i, 1); h.sec.fields.splice(j, 0, f); return; }
    const target = s.sections[si + dir];
    if (!target) return;
    const [f] = h.sec.fields.splice(h.i, 1);
    if (dir < 0) target.fields.push(f); else target.fields.unshift(f);
  });
  const moveTo = (key: string, secKey: string, beforeKey: string | null) => edit((s) => {
    const h = findField(s, key); const tgt = s.sections.find((x) => x.key === secKey);
    if (!h || !tgt || key === beforeKey) return;
    const [f] = h.sec.fields.splice(h.i, 1);
    const at = beforeKey ? tgt.fields.findIndex((x) => x.key === beforeKey) : -1;
    tgt.fields.splice(at < 0 ? tgt.fields.length : at, 0, f);
  });
  const addField = (secKey: string, type: FieldType) => {
    const f = emptyField(type);
    edit((s) => { s.sections.find((x) => x.key === secKey)?.fields.push(f); });
    setOpenKey(f.key); setAddFor(null);
  };
  const dupField = (key: string) => edit((s) => { const h = findField(s, key); if (h) { const c = duplicateField(h.sec.fields[h.i]); c.label = `${c.label} (สำเนา)`.trim(); h.sec.fields.splice(h.i + 1, 0, c); } });
  const changeType = (f: Field, to: FieldType) => {
    const apply = () => edit((s) => {
      const h = findField(s, f.key); if (!h) return;
      const x = h.sec.fields[h.i];
      x.type = to;
      if (isChoice(to) && !x.options?.length) x.options = [{ value: newKey("o"), label: "ตัวเลือก 1" }];
      if (!isChoice(to)) delete x.options;
      x.validation = isFileType(to) ? { maxFiles: 1, maxSizeMb: 5, ...(to === "file" ? { accept: ["image", "pdf"] as ("image" | "pdf")[] } : {}) } : undefined;
      if (x.mapsTo && !mappingAllows(x.mapsTo, to)) x.mapsTo = null;
    });
    const risk = typeChangeRisk(f.type, to);
    if (p.publishedTypes[f.key] && p.responses > 0 && risk === "lossy") {
      ask({ title: "เปลี่ยนชนิดคำถามที่มีคำตอบแล้ว?", confirmLabel: "เปลี่ยนชนิด", danger: true,
        body: `มีคำตอบ ${p.responses.toLocaleString("en-US")} รายการในเวอร์ชันที่เผยแพร่ การเปลี่ยนจาก “${FIELD_TYPE_LABEL[f.type]}” เป็น “${FIELD_TYPE_LABEL[to]}” จะมีผลกับคำตอบใหม่เท่านั้น คำตอบเดิมยังเก็บไว้กับเวอร์ชันเดิมไม่สูญหาย แต่การส่งออกจะมีคอลัมน์ที่ชนิดข้อมูลต่างกัน${f.mapsTo && !mappingAllows(f.mapsTo, to) ? ` และ Field Mapping “${mappingLabel(f.mapsTo)}” จะถูกยกเลิก` : ""}`,
        onConfirm: apply });
    } else if (f.mapsTo && !mappingAllows(f.mapsTo, to) && isCritical(f)) {
      ask({ title: "ชนิดใหม่ใช้กับข้อมูลที่ผูกไว้ไม่ได้", confirmLabel: "เปลี่ยนและยกเลิก Mapping", danger: true,
        body: `“${mappingLabel(f.mapsTo)}” ใช้ใน Workflow — ต้องผูกกับคำถามอื่นแทนก่อนเผยแพร่`, onConfirm: apply });
    } else apply();
  };
  const changeMapping = (f: Field, to: string | null) => {
    if (isCritical(f) && to !== f.mapsTo) {
      ask({ title: "เปลี่ยน Field Mapping ที่ Workflow ใช้?", confirmLabel: "เปลี่ยน Mapping", danger: true,
        body: `“${mappingLabel(f.mapsTo)}” ใช้สร้างข้อมูลผู้สมัครและการ์ด CEO — ต้องผูกคำถามอื่นแทนก่อนจึงจะเผยแพร่ได้`, onConfirm: () => updateField(f.key, { mapsTo: to }) });
    } else updateField(f.key, { mapsTo: to });
  };
  const addSection = () => edit((s) => { s.sections.push({ key: newKey("s"), title: `ส่วนที่ ${s.sections.length + 1}`, fields: [] }); });
  const removeSection = (sec: Section) => {
    const doit = () => edit((s) => { s.sections = s.sections.filter((x) => x.key !== sec.key); const gone = new Set(sec.fields.map((f) => f.key));
      for (const f of allFields(s)) if (f.showIf) { f.showIf = f.showIf.filter((c) => !gone.has(c.field)); if (!f.showIf.length) delete f.showIf; } });
    if (sec.fields.length) ask({ title: `ลบส่วน “${sec.title}” และคำถาม ${sec.fields.length} ข้อ?`, body: `${sec.fields.some(isCritical) ? "มีคำถามที่ผูกกับ Workflow — ต้องกำหนดคำถามแทนก่อนเผยแพร่ " : ""}คำตอบเก่าไม่ถูกลบ`, confirmLabel: "ลบส่วนนี้", danger: true, onConfirm: doit });
    else doit();
  };
  const moveSection = (key: string, dir: -1 | 1) => edit((s) => { const i = s.sections.findIndex((x) => x.key === key); const j = i + dir; if (i < 0 || j < 0 || j >= s.sections.length) return; const [x] = s.sections.splice(i, 1); s.sections.splice(j, 0, x); });

  const status = saving ? <span className="fe-save"><Loader2 className="spin" aria-hidden="true" />กำลังบันทึก…</span>
    : error ? <span className="fe-save" style={{ color: "var(--k-red-ink)" }}><CloudOff aria-hidden="true" />ยังไม่ได้บันทึก</span>
    : dirty ? <span className="fe-save">มีการแก้ไข · จะบันทึกอัตโนมัติ</span>
    : <span className="fe-save"><Cloud aria-hidden="true" />{savedAt ? `บันทึกร่างแล้ว ${new Date(savedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}` : "ร่างล่าสุดบันทึกแล้ว"}</span>;

  return (
    <div className="fe">
      <div className="fe-bar">
        <label className="sr-only" htmlFor="fe-title">ชื่อฟอร์ม</label>
        <input id="fe-title" className="k-input" value={title} maxLength={160} onChange={(e) => { setTitle(e.target.value); setChanges((c) => c + 1); }} />
        <span className="k-badge" data-tone={published.status === "published" ? "green" : published.status === "closed" ? "red" : "gray"}>
          {published.status === "published" ? `Published v${published.versionNo}` : published.status === "closed" ? `Closed (v${published.versionNo})` : "Draft"}
        </span>
        {status}
        <div className="k-actions" style={{ marginLeft: "auto" }}>
          <button type="button" className="k-btn sm" onClick={() => void save()} disabled={saving || !dirty}><Save aria-hidden="true" />Save Draft</button>
          <a className="k-btn sm soft" href={`/kol/forms/${p.formId}/preview?src=draft`} target="_blank" rel="noopener noreferrer" onClick={async (e) => { if (dirty) { e.preventDefault(); if ((await save()) !== null) window.open(`/kol/forms/${p.formId}/preview?src=draft`, "_blank", "noopener"); } }}><Eye aria-hidden="true" />Preview</a>
          <button type="button" className="k-btn sm primary" onClick={() => void publish()} disabled={publishing || saving}>
            {publishing ? <Loader2 className="spin" aria-hidden="true" /> : <Rocket aria-hidden="true" />}{published.versionNo ? "Publish เวอร์ชันใหม่" : "Publish"}
          </button>
        </div>
      </div>

      {published.just && (
        <div className="k-alert ok" role="status" style={{ marginTop: 18 }}><CheckCircle2 aria-hidden="true" /><span>เผยแพร่เวอร์ชัน {published.versionNo} แล้ว — ผู้ที่เปิดฟอร์มจากนี้ไปจะเห็นเวอร์ชันนี้ คำตอบเก่ายังอ้างอิงเวอร์ชันเดิม</span>
          {p.publicUrl && p.purpose !== "kol_registration" && <CopyButton text={p.publicUrl} label="Copy Public URL" className="k-btn sm white" />}</div>
      )}
      {!published.just && published.dirty && published.versionNo && (
        <div className="k-alert warn" style={{ marginTop: 18 }}><AlertCircle aria-hidden="true" /><span>ร่างนี้มีการแก้ไขที่ยังไม่เผยแพร่ (ผู้ตอบยังเห็นเวอร์ชัน {published.versionNo})</span>
          <button type="button" className="k-btn sm white" onClick={() => ask({ title: "ยกเลิกการแก้ไขที่ยังไม่เผยแพร่?", body: `ร่างจะกลับไปเหมือนเวอร์ชัน ${published.versionNo} ที่เผยแพร่อยู่`, confirmLabel: "ยกเลิกการแก้ไข", danger: true,
            onConfirm: async () => { const r = await discardDraft(p.formId); if (r.error) setError({ text: r.error }); else window.location.reload(); } })}><RotateCcw aria-hidden="true" />ยกเลิกการแก้ไข</button></div>
      )}
      {error && (
        <div className="k-alert err" role="alert" style={{ marginTop: 18 }}><AlertCircle aria-hidden="true" /><span>{error.text}</span>
          {error.conflict && <button type="button" className="k-btn sm white" onClick={() => window.location.reload()}>โหลดใหม่</button>}</div>
      )}
      {issues.length > 0 && <ul className="fe-issues" aria-label="สิ่งที่ต้องแก้ก่อนเผยแพร่">{issues.map((i, n) => <li key={n}>{i.message}</li>)}</ul>}

      <div className="fe-tabs" role="tablist" aria-label="ส่วนของตัวแก้ไข">
        <button type="button" role="tab" className="k-chip" aria-selected={tab === "questions"} onClick={() => setTab("questions")}><ListChecks aria-hidden="true" style={{ width: 16, height: 16 }} />คำถาม ({fields.length})</button>
        <button type="button" role="tab" className="k-chip" aria-selected={tab === "settings"} onClick={() => setTab("settings")}><Settings2 aria-hidden="true" style={{ width: 16, height: 16 }} />ตั้งค่าฟอร์ม</button>
        <span className="k-tag" style={{ alignSelf: "center" }}>{PURPOSE_LABEL[p.purpose]}</span>
      </div>

      {tab === "settings" ? <SettingsPanel schema={schema} edit={edit} formId={p.formId} publicUrl={p.purpose === "kol_registration" ? null : p.publicUrl} purpose={p.purpose} /> : (
        <>
          {schema.sections.map((sec, si) => (
            <section key={sec.key} className="fe-sec" data-drop={drag.sec === sec.key && !drag.over ? "true" : undefined} aria-label={`ส่วนที่ ${si + 1}`}
              onDragOver={(e) => { if (drag.key) { e.preventDefault(); if (drag.sec !== sec.key) setDrag((d) => ({ ...d, sec: sec.key })); } }}
              onDrop={(e) => { e.preventDefault(); if (drag.key && !drag.over) moveTo(drag.key, sec.key, null); setDrag({ key: null, over: null, sec: null }); }}>
              <div className="fe-sec-h">
                <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                  <label className="sr-only" htmlFor={`st-${sec.key}`}>ชื่อส่วน</label>
                  <input id={`st-${sec.key}`} className="k-input" value={sec.title} placeholder="ชื่อส่วน (Section)" maxLength={300} onChange={(e) => edit((s) => { s.sections[si].title = e.target.value; })} />
                  <label className="sr-only" htmlFor={`sd-${sec.key}`}>คำอธิบายส่วน</label>
                  <input id={`sd-${sec.key}`} className="k-input" value={sec.description ?? ""} placeholder="คำอธิบาย (ไม่บังคับ)" maxLength={1000} onChange={(e) => edit((s) => { s.sections[si].description = e.target.value || undefined; })} />
                  {p.purpose !== "general" && (
                    <label className="k-check" style={{ padding: 0, minHeight: 36 }}><input type="checkbox" checked={!!sec.showTerms} onChange={(e) => edit((s) => { s.sections[si].showTerms = e.target.checked || undefined; })} />แสดงเงื่อนไขแคมเปญปัจจุบันในส่วนนี้</label>
                  )}
                </div>
                <div className="k-actions" style={{ flexDirection: "column" }}>
                  <button type="button" className="k-ibtn" aria-label="ย้ายส่วนขึ้น" disabled={si === 0} onClick={() => moveSection(sec.key, -1)}><ArrowUp aria-hidden="true" /></button>
                  <button type="button" className="k-ibtn" aria-label="ย้ายส่วนลง" disabled={si === schema.sections.length - 1} onClick={() => moveSection(sec.key, 1)}><ArrowDown aria-hidden="true" /></button>
                  <button type="button" className="k-ibtn danger" aria-label={`ลบส่วน ${sec.title}`} disabled={schema.sections.length === 1} onClick={() => removeSection(sec)}><Trash2 aria-hidden="true" /></button>
                </div>
              </div>
              <ul className="fe-fields">
                {sec.fields.map((f, fi) => (
                  <FieldCard key={f.key} f={f} purpose={p.purpose} open={openKey === f.key} onToggle={() => setOpenKey(openKey === f.key ? null : f.key)}
                    prior={fields.slice(0, fields.findIndex((x) => x.key === f.key))} sections={schema.sections} sectionKey={sec.key}
                    first={si === 0 && fi === 0} last={si === schema.sections.length - 1 && fi === sec.fields.length - 1} critical={isCritical(f)}
                    dragging={drag.key === f.key} over={drag.over === f.key}
                    onDragStart={() => setDrag({ key: f.key, over: null, sec: null })} onDragEnd={() => setDrag({ key: null, over: null, sec: null })}
                    onDragOver={() => drag.key && drag.key !== f.key && drag.over !== f.key && setDrag((d) => ({ ...d, over: f.key, sec: sec.key }))}
                    onDrop={() => { if (drag.key) moveTo(drag.key, sec.key, f.key); setDrag({ key: null, over: null, sec: null }); }}
                    update={(patch) => updateField(f.key, patch)} remove={() => removeField(f)} duplicate={() => dupField(f.key)} move={(d) => moveField(f.key, d)}
                    moveToSection={(k) => moveTo(f.key, k, null)} changeType={(t) => changeType(f, t)} changeMapping={(m) => changeMapping(f, m)} />
                ))}
              </ul>
              {sec.fields.length === 0 && <p className="k-muted k-small" style={{ margin: "10px 4px 0" }}>ยังไม่มีคำถาม — ลากคำถามมาวางที่นี่ หรือกด + เพิ่มคำถาม</p>}
              <div className="fe-add">
                <button type="button" className="k-btn sm soft" aria-expanded={addFor === sec.key} onClick={() => setAddFor(addFor === sec.key ? null : sec.key)}><Plus aria-hidden="true" />เพิ่มคำถาม</button>
                {addFor === sec.key && (
                  <div className="fe-menu" role="menu" aria-label="เลือกประเภทคำถาม">
                    {FIELD_TYPES.map((t) => { const I = ICON[t]; return <button key={t} type="button" role="menuitem" onClick={() => addField(sec.key, t)}><I aria-hidden={true} />{FIELD_TYPE_LABEL[t]}</button>; })}
                  </div>
                )}
              </div>
            </section>
          ))}
          <button type="button" className="k-btn white" style={{ marginTop: 22 }} onClick={addSection}><Plus aria-hidden="true" />เพิ่มส่วน (Section)</button>
        </>
      )}

      <dialog ref={dlg} className="k-dialog" onClose={() => setModal(null)} aria-labelledby="fe-dlg-t">
        {modal && (
          <div className="k-dialog-body">
            <h2 id="fe-dlg-t">{modal.title}</h2><p>{modal.body}</p>
            <div className="k-actions end">
              <button type="button" className="k-btn" onClick={() => setModal(null)}>ยกเลิก</button>
              <button type="button" className={`k-btn ${modal.danger ? "danger-solid" : "primary"}`} onClick={() => { const m = modal; setModal(null); m.onConfirm(); }}>{modal.confirmLabel}</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

// ---------------------------------------------------------------- one question
function FieldCard(x: {
  f: Field; purpose: Purpose; open: boolean; onToggle: () => void; prior: Field[]; sections: Section[]; sectionKey: string; first: boolean; last: boolean;
  critical: boolean; dragging: boolean; over: boolean; onDragStart: () => void; onDragEnd: () => void; onDragOver: () => void; onDrop: () => void;
  update: (p: Partial<Field>) => void; remove: () => void; duplicate: () => void; move: (d: -1 | 1) => void; moveToSection: (k: string) => void;
  changeType: (t: FieldType) => void; changeMapping: (m: string | null) => void;
}) {
  const { f } = x;
  const I = ICON[f.type];
  const v = f.validation ?? {};
  const setV = (patch: Record<string, unknown>) => {
    const n: Record<string, unknown> = { ...v, ...patch };
    for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === "" || (typeof n[k] === "number" && Number.isNaN(n[k]))) delete n[k];
    x.update({ validation: Object.keys(n).length ? (n as Field["validation"]) : undefined });
  };
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
  const id = (s: string) => `fe-${f.key}-${s}`;
  return (
    <li className="fe-field" data-open={x.open} data-dragging={x.dragging || undefined} data-over={x.over || undefined}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); x.onDragOver(); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); x.onDrop(); }}>
      <div className="fe-sum">
        <span className="fe-handle" draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", f.key); x.onDragStart(); }} onDragEnd={x.onDragEnd}
          title="ลากเพื่อจัดลำดับ" aria-hidden="true"><GripVertical /></span>
        <span className="fe-type" title={FIELD_TYPE_LABEL[f.type]}><I aria-hidden={true} /></span>
        <button type="button" className="fe-label" aria-expanded={x.open} onClick={x.onToggle}>
          <b className={f.label ? "" : "empty"}>{f.label || "ยังไม่ได้ตั้งชื่อคำถาม"}</b>
          <span>
            <span className="k-tag">{FIELD_TYPE_LABEL[f.type]}</span>
            {f.required && <span className="k-tag" style={{ color: "var(--k-red-ink)" }}>บังคับตอบ</span>}
            {f.mapsTo && <span className="k-tag" style={{ color: "var(--k-sky-ink)" }} title="Field Mapping">↦ {mappingLabel(f.mapsTo)}</span>}
            {f.showIf?.length ? <span className="k-tag" style={{ color: "var(--k-purple-ink)" }}>มีเงื่อนไขการแสดง</span> : null}
            {x.critical && <span className="k-tag" style={{ color: "var(--k-amber-ink)" }}>Workflow</span>}
          </span>
        </button>
        <div className="k-actions" style={{ flexWrap: "nowrap", gap: 4 }}>
          <button type="button" className="k-ibtn" aria-label="ย้ายคำถามขึ้น" disabled={x.first} onClick={() => x.move(-1)}><ArrowUp aria-hidden="true" /></button>
          <button type="button" className="k-ibtn" aria-label="ย้ายคำถามลง" disabled={x.last} onClick={() => x.move(1)}><ArrowDown aria-hidden="true" /></button>
          <button type="button" className="k-ibtn" aria-label={x.open ? "ย่อการตั้งค่า" : "แก้ไขคำถาม"} onClick={x.onToggle}><ChevronDown aria-hidden="true" style={{ transform: x.open ? "rotate(180deg)" : undefined }} /></button>
        </div>
      </div>
      {x.open && (
        <div className="fe-edit">
          <div className="k-form-grid cols2">
            <label className="k-field span2" htmlFor={id("label")}><span className="k-label">คำถาม</span>
              <input id={id("label")} className="k-input" value={f.label} maxLength={300} onChange={(e) => x.update({ label: e.target.value })} autoFocus={!f.label} /></label>
            <label className="k-field span2" htmlFor={id("desc")}><span className="k-label">{f.type === "consent" ? "ข้อความยืนยันข้างช่องติ๊ก" : "คำอธิบาย"}</span>
              <textarea id={id("desc")} className="k-textarea" style={{ minHeight: 60 }} value={f.description ?? ""} maxLength={1000} onChange={(e) => x.update({ description: e.target.value || undefined })} /></label>
            <label className="k-field" htmlFor={id("type")}><span className="k-label">ประเภทคำถาม</span>
              <select id={id("type")} className="k-select" value={f.type} onChange={(e) => x.changeType(e.target.value as FieldType)}>
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>)}</select></label>
            {["short_text", "long_text", "number", "phone", "email", "url"].includes(f.type) && (
              <label className="k-field" htmlFor={id("ph")}><span className="k-label">Placeholder</span>
                <input id={id("ph")} className="k-input" value={f.placeholder ?? ""} maxLength={120} onChange={(e) => x.update({ placeholder: e.target.value || undefined })} /></label>
            )}
            <label className="k-check span2"><input type="checkbox" checked={f.required} onChange={(e) => x.update({ required: e.target.checked })} />บังคับตอบ (Required)</label>
          </div>

          {isChoice(f.type) && <OptionsEditor f={f} update={x.update} />}

          <details style={{ marginTop: 18 }} open={!!f.validation && !isFileType(f.type)}>
            <summary className="k-label" style={{ cursor: "pointer" }}>Validation</summary>
            <div className="k-form-grid cols2" style={{ marginTop: 8 }}>
              {(f.type === "short_text" || f.type === "long_text") && <>
                <label className="k-field"><span className="k-label">จำนวนอักขระขั้นต่ำ</span><input className="k-input" inputMode="numeric" value={v.minLength ?? ""} onChange={(e) => setV({ minLength: num(e.target.value) })} /></label>
                <label className="k-field"><span className="k-label">จำนวนอักขระสูงสุด</span><input className="k-input" inputMode="numeric" value={v.maxLength ?? ""} placeholder={f.type === "short_text" ? "200" : "2000"} onChange={(e) => setV({ maxLength: num(e.target.value) })} /></label>
              </>}
              {f.type === "number" && <>
                <label className="k-field"><span className="k-label">ค่าต่ำสุด</span><input className="k-input" inputMode="numeric" value={v.min ?? ""} onChange={(e) => setV({ min: num(e.target.value) })} /></label>
                <label className="k-field"><span className="k-label">ค่าสูงสุด</span><input className="k-input" inputMode="numeric" value={v.max ?? ""} onChange={(e) => setV({ max: num(e.target.value) })} /></label>
                <label className="k-check span2"><input type="checkbox" checked={!!v.integer} onChange={(e) => setV({ integer: e.target.checked || undefined })} />จำนวนเต็มเท่านั้น</label>
              </>}
              {f.type === "url" && (
                <label className="k-field span2"><span className="k-label">อนุญาตเฉพาะโดเมน (คั่นด้วย ,)</span>
                  <input className="k-input" value={(v.urlHosts ?? []).join(", ")} placeholder="เช่น instagram.com, tiktok.com" onChange={(e) => setV({ urlHosts: e.target.value.split(/[,\s]+/).map((h) => h.trim().toLowerCase()).filter(Boolean) })} /></label>
              )}
              {f.type === "multiple_choice" && <>
                <label className="k-field"><span className="k-label">เลือกอย่างน้อย</span><input className="k-input" inputMode="numeric" value={v.minSelect ?? ""} onChange={(e) => setV({ minSelect: num(e.target.value) })} /></label>
                <label className="k-field"><span className="k-label">เลือกได้สูงสุด</span><input className="k-input" inputMode="numeric" value={v.maxSelect ?? ""} onChange={(e) => setV({ maxSelect: num(e.target.value) })} /></label>
              </>}
              {f.type === "date" && <label className="k-check span2"><input type="checkbox" checked={!!v.notPast} onChange={(e) => setV({ notPast: e.target.checked || undefined })} />ห้ามเลือกวันที่ผ่านมาแล้ว</label>}
              {isFileType(f.type) && <>
                <label className="k-field"><span className="k-label">จำนวนไฟล์สูงสุด (1–5)</span><input className="k-input" inputMode="numeric" value={v.maxFiles ?? 1} onChange={(e) => setV({ maxFiles: num(e.target.value) })} /></label>
                <label className="k-field"><span className="k-label">ขนาดไฟล์สูงสุด (MB, 1–10)</span><input className="k-input" inputMode="numeric" value={v.maxSizeMb ?? 5} onChange={(e) => setV({ maxSizeMb: num(e.target.value) })} /></label>
                {f.type === "file" && (
                  <fieldset className="span2" style={{ border: 0, padding: 0, margin: 0 }}><legend className="k-label">ประเภทไฟล์ที่อนุญาต</legend>
                    {(["image", "pdf"] as const).map((a) => (
                      <label key={a} className="k-check" style={{ display: "inline-flex", marginRight: 16 }}>
                        <input type="checkbox" checked={(v.accept ?? ["image", "pdf"]).includes(a)} onChange={(e) => { const cur = new Set(v.accept ?? ["image", "pdf"]); if (e.target.checked) cur.add(a); else cur.delete(a); setV({ accept: cur.size ? [...cur] : ["image"] }); }} />
                        {a === "image" ? "รูปภาพ (JPG/PNG/WebP)" : "PDF"}</label>
                    ))}</fieldset>
                )}
              </>}
              {["phone", "email", "time", "checkbox", "consent", "single_choice", "dropdown"].includes(f.type) && <p className="k-hint span2" style={{ margin: 0 }}>ระบบตรวจรูปแบบให้อัตโนมัติตามประเภทคำถาม</p>}
            </div>
          </details>

          <ConditionEditor f={f} prior={x.prior} update={x.update} />
          <MappingEditor f={f} purpose={x.purpose} critical={x.critical} change={x.changeMapping} update={x.update} />

          <div className="k-actions" style={{ marginTop: 22 }}>
            <button type="button" className="k-btn sm" onClick={x.duplicate}><Copy aria-hidden="true" />Duplicate</button>
            {x.sections.length > 1 && (
              <label className="k-row" style={{ gap: 6 }}><span className="k-small k-muted">ย้ายไปส่วน</span>
                <select className="k-select" style={{ minHeight: 38, width: "auto" }} value={x.sectionKey} onChange={(e) => x.moveToSection(e.target.value)}>
                  {x.sections.map((s, i) => <option key={s.key} value={s.key}>{i + 1}. {s.title || "ไม่มีชื่อ"}</option>)}</select></label>
            )}
            <button type="button" className="k-btn sm danger" style={{ marginLeft: "auto" }} onClick={x.remove}><Trash2 aria-hidden="true" />ลบคำถาม</button>
          </div>
        </div>
      )}
    </li>
  );
}

function OptionsEditor({ f, update }: { f: Field; update: (p: Partial<Field>) => void }) {
  const opts = f.options ?? [];
  const set = (o: typeof opts) => update({ options: o });
  return (
    <div style={{ marginTop: 18 }}>
      <span className="k-label">ตัวเลือก</span>
      <ul className="fe-opts">
        {opts.map((o, i) => (
          <li key={o.value}>
            <label className="sr-only" htmlFor={`op-${o.value}`}>ตัวเลือกที่ {i + 1}</label>
            <input id={`op-${o.value}`} className="k-input" value={o.label} maxLength={200} onChange={(e) => set(opts.map((x) => (x.value === o.value ? { ...x, label: e.target.value } : x)))} />
            <button type="button" className="k-ibtn" aria-label="เลื่อนตัวเลือกขึ้น" disabled={i === 0} onClick={() => { const n = [...opts]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set(n); }}><ArrowUp aria-hidden="true" /></button>
            <button type="button" className="k-ibtn" aria-label="เลื่อนตัวเลือกลง" disabled={i === opts.length - 1} onClick={() => { const n = [...opts]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set(n); }}><ArrowDown aria-hidden="true" /></button>
            <button type="button" className="k-ibtn danger" aria-label={`ลบตัวเลือก ${o.label}`} disabled={opts.length <= 1} onClick={() => set(opts.filter((x) => x.value !== o.value))}><X aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <button type="button" className="k-btn sm ghost" style={{ marginTop: 6 }} onClick={() => set([...opts, { value: newKey("o"), label: `ตัวเลือก ${opts.length + 1}` }])}><Plus aria-hidden="true" />เพิ่มตัวเลือก</button>
    </div>
  );
}

function ConditionEditor({ f, prior, update }: { f: Field; prior: Field[]; update: (p: Partial<Field>) => void }) {
  const conds = f.showIf ?? [];
  const sources = prior.filter((p) => !isFileType(p.type));
  const set = (c: Condition[]) => update({ showIf: c.length ? c : undefined });
  const opsFor = (src?: Field): CondOp[] => !src ? ["not_empty"] : src.type === "multiple_choice" ? ["includes", "not_includes", "not_empty", "empty"]
    : CHOICE_TYPES.includes(src.type) ? ["equals", "not_equals", "not_empty", "empty"] : src.type === "checkbox" || src.type === "consent" ? ["not_empty", "empty"] : ["equals", "not_equals", "not_empty", "empty"];
  return (
    <details style={{ marginTop: 18 }} open={conds.length > 0}>
      <summary className="k-label" style={{ cursor: "pointer" }}>Conditional Logic — แสดงคำถามนี้เมื่อ…</summary>
      {sources.length === 0 ? <p className="k-hint">ต้องมีคำถามก่อนหน้าจึงจะตั้งเงื่อนไขได้</p> : (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {conds.map((c, i) => {
            const src = sources.find((s) => s.key === c.field);
            const ops = opsFor(src);
            return (
              <div key={i} className="fe-cond">
                <label className="k-field"><span className="k-label">{i === 0 ? "ถ้าคำถาม" : "และคำถาม"}</span>
                  <select className="k-select" value={c.field} onChange={(e) => { const s2 = sources.find((s) => s.key === e.target.value); const op = opsFor(s2)[0]; set(conds.map((x, j) => (j === i ? { field: e.target.value, op, value: s2?.options?.[0]?.value } : x))); }}>
                    {sources.map((s) => <option key={s.key} value={s.key}>{s.label || "(ไม่มีชื่อ)"}</option>)}</select></label>
                <label className="k-field"><span className="k-label">เงื่อนไข</span>
                  <select className="k-select" value={c.op} onChange={(e) => set(conds.map((x, j) => (j === i ? { ...x, op: e.target.value as CondOp } : x)))}>
                    {ops.map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}</select></label>
                {c.op !== "empty" && c.op !== "not_empty" ? (
                  <label className="k-field"><span className="k-label">ค่า</span>
                    {src?.options ? (
                      <select className="k-select" value={c.value ?? ""} onChange={(e) => set(conds.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}>
                        {src.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                    ) : <input className="k-input" value={c.value ?? ""} onChange={(e) => set(conds.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />}
                  </label>
                ) : <span />}
                <button type="button" className="k-ibtn danger" aria-label="ลบเงื่อนไข" onClick={() => set(conds.filter((_, j) => j !== i))}><X aria-hidden="true" /></button>
              </div>
            );
          })}
          {conds.length < 5 && (
            <button type="button" className="k-btn sm ghost" style={{ justifySelf: "start" }} onClick={() => { const s = sources.at(-1)!; set([...conds, { field: s.key, op: opsFor(s)[0], value: s.options?.[0]?.value }]); }}>
              <Plus aria-hidden="true" />{conds.length ? "เพิ่มเงื่อนไข (และ)" : "ตั้งเงื่อนไขการแสดง"}</button>
          )}
        </div>
      )}
    </details>
  );
}

function MappingEditor({ f, purpose, critical, change, update }: { f: Field; purpose: Purpose; critical: boolean; change: (m: string | null) => void; update: (p: Partial<Field>) => void }) {
  const social = f.type === "url" || f.type === "number";
  const part = f.type === "url" ? "url" : "followers";
  const cur = f.mapsTo ?? "";
  const sm = SOCIAL_MAP_RE.exec(cur);
  const presetKeys = SOCIAL_PRESETS.map((s) => s.key);
  const [custom, setCustom] = useState(sm && !presetKeys.includes(sm[1]) ? sm[1] : "");
  const groups = [...new Set(MAPPINGS.filter((m) => m.types.includes(f.type)).map((m) => m.group))];
  return (
    <details style={{ marginTop: 18 }} open={!!f.mapsTo}>
      <summary className="k-label" style={{ cursor: "pointer" }}>Field Mapping — คำถามนี้เชื่อมกับข้อมูลส่วนไหน</summary>
      <div className="k-form-grid cols2" style={{ marginTop: 8 }}>
        <label className="k-field span2"><span className="k-label">ข้อมูลในระบบ</span>
          <select className="k-select" value={sm && !presetKeys.includes(sm[1]) ? "social.custom" : cur} onChange={(e) => change(e.target.value === "social.custom" ? (custom ? `social.${custom}.${part}` : null) : e.target.value || null)}>
            <option value="">ไม่ผูกข้อมูล (เก็บเป็นคำตอบอย่างเดียว)</option>
            {groups.map((g) => <optgroup key={g} label={g}>{MAPPINGS.filter((m) => m.group === g && m.types.includes(f.type)).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</optgroup>)}
            {social && <optgroup label="Social Media">
              {SOCIAL_PRESETS.map((s) => <option key={s.key} value={`social.${s.key}.${part}`}>{s.label} · {part === "url" ? "ลิงก์โปรไฟล์" : "จำนวน Followers"}</option>)}
              <option value="social.custom">ช่องทางใหม่ (ระบุชื่อ)…</option>
            </optgroup>}
          </select></label>
        {social && (sm && !presetKeys.includes(sm[1]) || cur === "") && (
          <label className="k-field span2"><span className="k-label">ชื่อช่องทางใหม่ (a–z, 0–9, _) — ใช้เพิ่มช่องทาง Social Media จากหลังบ้าน</span>
            <input className="k-input" value={custom} placeholder="เช่น lemon8 หรือ blockdit" onChange={(e) => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24); setCustom(v); if (PLATFORM_RE.test(v)) change(`social.${v}.${part}`); }} /></label>
        )}
        {purpose === "kol_registration" && f.mapsTo && (
          <>
            <label className="k-check"><input type="checkbox" checked={!!f.prefill} onChange={(e) => update({ prefill: e.target.checked || undefined, locked: e.target.checked ? f.locked : undefined })} />เติมข้อมูลจากใบสมัคร (Prefill)</label>
            {f.prefill && <label className="k-check"><input type="checkbox" checked={!!f.locked} onChange={(e) => update({ locked: e.target.checked || undefined })} />ห้ามผู้สมัครแก้ไข</label>}
          </>
        )}
        {critical && <p className="k-hint span2" style={{ margin: 0, color: "var(--k-amber-ink)" }}>ข้อมูลนี้ใช้ใน Workflow — ถ้าเปลี่ยนต้องกำหนดคำถามอื่นแทนก่อนจึงจะเผยแพร่ได้</p>}
        <p className="k-hint span2" style={{ margin: 0 }}>รหัสคำถามภายใน: <code>{f.key}</code> (คงที่ แม้เปลี่ยนชื่อคำถาม การ์ด CEO จึงไม่เสีย)</p>
      </div>
    </details>
  );
}

function SettingsPanel({ schema, edit, formId, publicUrl, purpose }: { schema: FormSchema; edit: (fn: (s: FormSchema) => void) => void; formId: string; publicUrl: string | null; purpose: Purpose }) {
  const s = schema.settings;
  const [upload, setUpload] = useState<{ busy?: boolean; error?: string }>({});
  const set = (patch: Partial<typeof s>) => edit((x) => { Object.assign(x.settings, patch); });
  return (
    <section className="k-card" style={{ marginTop: 22 }} aria-label="ตั้งค่าฟอร์ม">
      {publicUrl ? (
        <div className="k-row between" style={{ marginBottom: 12 }}><span className="k-small k-ellipsis k-grow">Public URL: {publicUrl}</span><CopyButton text={publicUrl} label="Copy Public URL" /></div>
      ) : purpose === "kol_registration" && <p className="k-hint" style={{ marginTop: 0 }}>ฟอร์ม STEP 2 เปิดได้เฉพาะลิงก์ Token ที่ออกให้ผู้ผ่านอนุมัติแต่ละคน</p>}
      <div className="k-form-grid cols2">
        <div className="k-field span2">
          <span className="k-label">ภาพหน้าปก (Hero Image) — ใช้ภาพสนาม Wonder Courts จริง</span>
          {s.heroFileId && <img src={`/api/public/hero/${s.heroFileId}`} alt="ภาพหน้าปกปัจจุบัน" style={{ width: "100%", maxWidth: 420, aspectRatio: "16/10", objectFit: "cover", borderRadius: 18, marginBottom: 8 }} />}
          <div className="k-actions">
            <label className="k-btn sm soft" style={{ position: "relative" }}>
              {upload.busy ? <Loader2 className="spin" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}{s.heroFileId ? "เปลี่ยนภาพ" : "อัปโหลดภาพ"}
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} disabled={upload.busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
                  setUpload({ busy: true });
                  const fd = new FormData(); fd.append("file", file);
                  const r = await fetch(`/api/kol/forms/${formId}/hero`, { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({ error: "อัปโหลดไม่สำเร็จ" }));
                  if (r.id) { set({ heroFileId: r.id }); setUpload({}); } else setUpload({ error: r.error ?? "อัปโหลดไม่สำเร็จ" });
                }} />
            </label>
            {s.heroFileId && <button type="button" className="k-btn sm ghost" onClick={() => set({ heroFileId: null })}>นำภาพออก</button>}
          </div>
          {upload.error && <p className="k-alert err" role="alert" style={{ marginTop: 8 }}><AlertCircle aria-hidden="true" />{upload.error}</p>}
          {!s.heroFileId && <p className="k-hint">ยังไม่มีภาพ — ฟอร์มจะแสดงภาพวาดเส้นคอร์ทแทน (ไม่ใช้ภาพสถานที่อื่น)</p>}
        </div>
        <label className="k-field span2"><span className="k-label">ข้อความแนะนำ (หน้าแรก)</span><textarea className="k-textarea" value={s.intro} maxLength={2000} onChange={(e) => set({ intro: e.target.value })} /></label>
        <label className="k-field"><span className="k-label">ปุ่มเริ่ม</span><input className="k-input" value={s.startLabel} maxLength={40} onChange={(e) => set({ startLabel: e.target.value })} /></label>
        <label className="k-field"><span className="k-label">ปุ่มส่ง</span><input className="k-input" value={s.submitLabel} maxLength={40} onChange={(e) => set({ submitLabel: e.target.value })} /></label>
        <label className="k-field span2"><span className="k-label">หน้าส่งสำเร็จ — หัวข้อ</span><input className="k-input" value={s.successTitle} maxLength={120} onChange={(e) => set({ successTitle: e.target.value })} /></label>
        <label className="k-field span2"><span className="k-label">หน้าส่งสำเร็จ — ข้อความ</span><textarea className="k-textarea" value={s.successMessage} maxLength={2000} onChange={(e) => set({ successMessage: e.target.value })} /></label>
        <label className="k-field span2"><span className="k-label">Privacy Notice</span><textarea className="k-textarea" value={s.privacyNotice} maxLength={2000} onChange={(e) => set({ privacyNotice: e.target.value })} /></label>
        <label className="k-field"><span className="k-label">ลิงก์เอกสารประกอบ (https://)</span><input className="k-input" type="url" value={s.linkUrl ?? ""} onChange={(e) => set({ linkUrl: e.target.value || null })} /></label>
        <label className="k-field"><span className="k-label">ชื่อลิงก์</span><input className="k-input" value={s.linkLabel ?? ""} maxLength={80} onChange={(e) => set({ linkLabel: e.target.value || null })} /></label>
      </div>
    </section>
  );
}
