/* eslint-disable @next/next/no-img-element -- images come from Postgres through our own routes (/api/kol/files, /api/public/hero) or local blob previews; next/image would need a custom loader */
"use client";
import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, Clock3, Copy, ExternalLink, FileText, ImagePlus, Loader2, Lock, RotateCcw,
  Send, ShieldCheck, Trash2, Upload, Sparkles,
} from "lucide-react";
import {
  displayAnswer, isChoice, isFileType, validateAnswers, visibleKeys, visibleSections, bangkokTodayIso,
  type Answers, type AnswerValue, type Field, type FileRef, type FormSchema, type Section,
} from "@/lib/forms-core";
import { submitPublic, submitStep2, type PublicState } from "@/app/(public)/actions";

export type PublicTerms = { id: string; versionNo: number; title: string; items: string[] } | null;
type Mode = "public" | "registration" | "preview";
type Props = {
  mode: Mode; formId: string; slug: string; versionId: string; title: string; schema: FormSchema; terms: PublicTerms; stamp: string;
  token?: string; initial?: Answers; prefilledKeys?: string[]; heroUrl: string | null; greeting?: string;
};
type Upload = FileRef & { preview?: string };
type Pending = { tmp: string; name: string; error?: string; file?: File };

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function PublicForm(p: Props) {
  const storeKey = `wc-form:${p.formId}:${p.versionId}${p.token ? `:${p.token.slice(0, 10)}` : ""}`;
  const [answers, setAnswers] = useState<Answers>(() => ({ ...(p.initial ?? {}) }));
  const [step, setStep] = useState(-1); // -1 landing · 0..n-1 sections · n review
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, Pending[]>>({});
  const [restoreDismissed, setRestoreDismissed] = useState(false);
  // Draft kept on this device only (not on the server) so a refresh or a closed LINE browser does not lose answers.
  const savedRaw = useSyncExternalStore(noopSubscribe, () => readStore(storeKey), () => null);
  const restore = useMemo<Answers | null>(() => {
    if (p.mode === "preview" || restoreDismissed || !savedRaw) return null;
    try {
      const saved = JSON.parse(savedRaw) as { answers: Answers; at: number };
      return saved?.answers && Date.now() - saved.at < 7 * 86_400_000 && Object.keys(saved.answers).length ? saved.answers : null;
    } catch { return null; }
  }, [savedRaw, restoreDismissed, p.mode]);
  const [clientKey] = useState(newKey);
  const [copied, setCopied] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const action = p.mode === "registration" ? submitStep2 : submitPublic;
  const [state, submit, pending] = useActionState(async (prev: PublicState, fd: FormData) => {
    if (p.mode === "preview") return { error: "โหมดตัวอย่าง — ไม่มีการบันทึกข้อมูล" } as PublicState;
    const r = await action(prev, fd);
    if (r.done) { try { localStorage.removeItem(storeKey); } catch { /* ignore */ } }
    if (r.errors && Object.keys(r.errors).length) {
      setErrors(r.errors);
      const first = visibleSections(p.schema, answers).findIndex((s) => s.fields.some((f) => r.errors![f.key]));
      if (first >= 0) goTo(first);
    }
    return r;
  }, {} as PublicState);

  const sections = useMemo(() => visibleSections(p.schema, answers), [p.schema, answers]);
  const visible = useMemo(() => visibleKeys(p.schema, answers), [p.schema, answers]);
  const total = sections.length;
  const prefilled = new Set(p.prefilledKeys ?? []);

  useEffect(() => {
    if (p.mode === "preview" || state.done) return;
    const t = setTimeout(() => { try { localStorage.setItem(storeKey, JSON.stringify({ answers, at: Date.now() }, (k, v) => (k === "preview" ? undefined : v))); } catch { /* ignore */ } }, 600);
    return () => clearTimeout(t);
  }, [answers, storeKey, p.mode, state.done]);

  function goTo(i: number) {
    setStep(i);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
  }
  function set(key: string, v: AnswerValue) {
    setAnswers((a) => ({ ...a, [key]: v }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }
  function next() {
    const sec = sections[step];
    if (sec) {
      if (Object.values(uploading).some((l) => l.some((x) => !x.error))) { setErrors({ ...errors, $form: "รออัปโหลดไฟล์ให้เสร็จก่อน" }); return; }
      const { errors: e } = validateAnswers(p.schema, answers, { sectionKey: sec.key, today: bangkokTodayIso() });
      setErrors(e);
      if (Object.keys(e).length) {
        const k = Object.keys(e)[0];
        requestAnimationFrame(() => document.getElementById(`pf-${k}`)?.focus({ preventScroll: false }));
        return;
      }
    }
    goTo(step + 1);
  }

  const termsBlock = (sec: Section) => sec.showTerms && p.terms ? (
    <div className="pf-terms" role="region" aria-label="เงื่อนไขแคมเปญ">
      <h3>เงื่อนไขแคมเปญปัจจุบัน <small>เวอร์ชัน {p.terms.versionNo}</small></h3>
      <ul>{p.terms.items.map((t, i) => <li key={i}><Check aria-hidden="true" /><span>{t}</span></li>)}</ul>
    </div>
  ) : null;

  // ---------------------------------------------------------------- done
  if (state.done) {
    return (
      <Shell mode={p.mode}>
        <div className="pf-done" role="status">
          <div className="pf-done-ic"><CheckCircle2 aria-hidden="true" /></div>
          <h1>{state.done.title}</h1>
          {state.done.message && <p>{state.done.message}</p>}
          <div className="pf-ref"><small>เลขอ้างอิง</small><b>{state.done.ref}</b></div>
          {state.done.statusUrl && (
            <div className="pf-statuslink">
              <p><b>ลิงก์ติดตามสถานะใบสมัคร</b> — เปิดดูได้เฉพาะคุณ เก็บลิงก์นี้ไว้ (ระบบแสดงครั้งเดียว)</p>
              <code>{state.done.statusUrl}</code>
              <button type="button" className="pf-btn block" onClick={async () => { await copyText(state.done!.statusUrl!); setCopied(true); }}>
                {copied ? <><Check aria-hidden="true" />คัดลอกแล้ว</> : <><Copy aria-hidden="true" />คัดลอกลิงก์ติดตามสถานะ</>}
              </button>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  // ---------------------------------------------------------------- landing
  if (step === -1) {
    return (
      <Shell mode={p.mode}>
        <div ref={topRef} />
        <span className="pf-brand"><span className="pf-ball" aria-hidden="true" />Wonder Courts</span>
        <Hero url={p.heroUrl} />
        <h1 className="pf-title">{p.title}</h1>
        {p.greeting && <p className="pf-intro"><b>{p.greeting}</b></p>}
        {p.schema.settings.intro && <p className="pf-intro">{p.schema.settings.intro}</p>}
        <div className="pf-facts">
          <span className="pf-fact"><Clock3 aria-hidden="true" />{total} ขั้นตอน</span>
          {p.mode !== "registration" && <span className="pf-fact"><ShieldCheck aria-hidden="true" />ไม่ต้องสมัครสมาชิก</span>}
          {p.mode === "registration" && <span className="pf-fact"><Sparkles aria-hidden="true" />ข้อมูลจากใบสมัครเติมให้แล้ว</span>}
        </div>
        {p.schema.settings.linkUrl && (
          <a className="pf-link" href={p.schema.settings.linkUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />{p.schema.settings.linkLabel || "อ่านรายละเอียดเพิ่มเติม"}
          </a>
        )}
        {restore && (
          <div className="pf-restore" role="status">
            <span>พบข้อมูลที่กรอกค้างไว้ในเครื่องนี้</span>
            <button type="button" onClick={() => { setAnswers({ ...(p.initial ?? {}), ...restore }); setRestoreDismissed(true); goTo(0); }}>กรอกต่อ</button>
            <button type="button" onClick={() => { setRestoreDismissed(true); try { localStorage.removeItem(storeKey); } catch { /* ignore */ } }}>เริ่มใหม่</button>
          </div>
        )}
        <div className="pf-spacer" />
        <button type="button" className="pf-btn primary block pf-start" onClick={() => goTo(0)}>
          {p.schema.settings.startLabel}<ArrowRight aria-hidden="true" />
        </button>
        {p.schema.settings.privacyNotice && <p className="pf-note"><Lock aria-hidden="true" /><span>{p.schema.settings.privacyNotice}</span></p>}
      </Shell>
    );
  }

  const onReview = step >= total;
  const sec = sections[Math.min(step, total - 1)];
  const progress = Math.round(((onReview ? total : step) / Math.max(total, 1)) * 100);

  return (
    <Shell mode={p.mode}>
      <div ref={topRef} />
      <div className="pf-head">
        <button type="button" className="pf-iconbtn" onClick={() => goTo(step - 1)}><ChevronLeft aria-hidden="true" />ย้อนกลับ</button>
        <div className="pf-head-title">{p.title}</div>
        <div className="pf-head-step" aria-label={onReview ? "ขั้นตรวจสอบ" : `ขั้นที่ ${step + 1} จาก ${total}`}>{onReview ? "ตรวจสอบ" : `${step + 1}/${total}`}</div>
      </div>
      <div className="pf-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="ความคืบหน้า"><i style={{ width: `${progress}%` }} /></div>

      {!onReview && sec ? (
        <>
          <h2 className="pf-sec-title">{sec.title}</h2>
          {sec.description && <p className="pf-sec-desc">{sec.description}</p>}
          {termsBlock(sec)}
          <div className="pf-card">
            {sec.fields.filter((f) => visible.has(f.key)).map((f) => (
              <FieldInput key={f.key} f={f} value={answers[f.key]} error={errors[f.key]} onChange={(v) => set(f.key, v)} prefilled={prefilled.has(f.key)}
                formId={p.formId} token={p.token} preview={p.mode === "preview"} uploading={uploading[f.key] ?? []}
                setUploading={(fn) => setUploading((u) => ({ ...u, [f.key]: fn(u[f.key] ?? []) }))} />
            ))}
          </div>
          {errors.$form && <div className="pf-alert" role="alert"><AlertCircle aria-hidden="true" />{errors.$form}</div>}
          <div className="pf-spacer" />
          <div className="pf-bar">
            <button type="button" className="pf-btn" onClick={() => goTo(step - 1)}><ArrowLeft aria-hidden="true" />ย้อนกลับ</button>
            <button type="button" className="pf-btn primary" onClick={next}>{step === total - 1 ? "ตรวจสอบข้อมูล" : "ถัดไป"}<ArrowRight aria-hidden="true" /></button>
          </div>
        </>
      ) : (
        <form action={submit} noValidate>
          <h2 className="pf-sec-title">ตรวจสอบข้อมูลก่อนส่ง</h2>
          <p className="pf-sec-desc">กด “แก้ไข” เพื่อกลับไปแก้คำตอบ ข้อมูลที่กรอกจะไม่หาย</p>
          <div className="pf-review">
            {sections.map((s, i) => (
              <section key={s.key} aria-labelledby={`rv-${s.key}`}>
                <header><h3 id={`rv-${s.key}`}>{s.title}</h3><button type="button" className="pf-edit" onClick={() => goTo(i)}>แก้ไข</button></header>
                <dl>
                  {s.fields.filter((f) => visible.has(f.key)).map((f) => {
                    const txt = displayAnswer(f, answers[f.key] as AnswerValue);
                    return <div key={f.key}><dt>{f.label}</dt><dd className={txt ? "" : "empty"}>{txt || "ไม่ได้กรอก"}</dd></div>;
                  })}
                </dl>
              </section>
            ))}
          </div>
          {state.error && (
            <div className="pf-alert" role="alert">
              <AlertCircle aria-hidden="true" /><span>{state.error}</span>
              {state.reload && <button type="button" onClick={() => window.location.reload()}>โหลดใหม่</button>}
            </div>
          )}
          <input type="hidden" name="answers" value={JSON.stringify(answers)} />
          <input type="hidden" name="client_key" value={clientKey} />
          <input type="hidden" name="version_id" value={p.versionId} />
          <input type="hidden" name="slug" value={p.slug} />
          <input type="hidden" name="stamp" value={p.stamp} />
          {p.terms && <input type="hidden" name="terms_id" value={p.terms.id} />}
          {p.token && <input type="hidden" name="token" value={p.token} />}
          <div className="pf-hp" aria-hidden="true"><label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <div className="pf-spacer" />
          <div className="pf-bar">
            <button type="button" className="pf-btn" onClick={() => goTo(total - 1)} disabled={pending}><ArrowLeft aria-hidden="true" />ย้อนกลับ</button>
            <button type="submit" className="pf-btn primary" disabled={pending} aria-busy={pending}>
              {pending ? <><Loader2 className="spin" aria-hidden="true" />กำลังส่ง…</> : <><Send aria-hidden="true" />{p.schema.settings.submitLabel}</>}
            </button>
          </div>
        </form>
      )}
    </Shell>
  );
}

const noopSubscribe = () => () => {};
function readStore(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function Shell({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  return (
    <div className="pf-root" data-preview={mode === "preview" ? "" : undefined}>
      <div className="pf-wrap">
        {mode === "preview" && <div className="pf-preview-note">ตัวอย่างฟอร์ม — กดส่งได้แต่ไม่บันทึกข้อมูล</div>}
        {children}
      </div>
    </div>
  );
}

function Hero({ url }: { url: string | null }) {
  return (
    <div className="pf-hero">
      {url ? <img src={url} alt="สนาม Wonder Courts" /> : (
        <div className="pf-hero-art" aria-hidden="true">
          {/* Illustration (not a photo): court lines and a ball, used until the real court photo is uploaded in the Form Builder. */}
          <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice">
            <defs><linearGradient id="pfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#cfe6f8" /><stop offset="1" stopColor="#e3f1dc" /></linearGradient></defs>
            <rect width="400" height="250" fill="url(#pfg)" />
            <g fill="none" stroke="#fff" strokeWidth="3" opacity=".9">
              <path d="M70 230 L130 40 L270 40 L330 230 Z" /><path d="M98 140 L302 140" /><path d="M200 40 L200 230" /><path d="M86 180 L314 180" strokeDasharray="6 8" />
            </g>
            <circle cx="300" cy="78" r="18" fill="#c9e26f" /><path d="M287 66 q13 12 0 24 M313 66 q-13 12 0 24" stroke="#fff" strokeWidth="2.5" fill="none" />
          </svg>
          <span className="pf-hero-label">Wonder Courts</span>
        </div>
      )}
    </div>
  );
}

async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); return; } catch { /* fall back */ }
  const ta = document.createElement("textarea");
  ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } finally { ta.remove(); }
}

// ---------------------------------------------------------------- field renderer
function FieldInput({ f, value, error, onChange, prefilled, formId, token, preview, uploading, setUploading }: {
  f: Field; value: AnswerValue | undefined; error?: string; onChange: (v: AnswerValue) => void; prefilled: boolean;
  formId: string; token?: string; preview: boolean; uploading: Pending[]; setUploading: (fn: (l: Pending[]) => Pending[]) => void;
}) {
  const id = `pf-${f.key}`;
  const descId = f.description ? `${id}-d` : undefined;
  const errId = error ? `${id}-e` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;
  const readOnly = prefilled && f.locked;
  const label = (
    <>
      {f.label || "(ไม่มีชื่อคำถาม)"}{f.required ? <span className="pf-req" aria-hidden="true">*</span> : <span className="pf-opt">(ไม่บังคับ)</span>}
    </>
  );
  const desc = f.description && f.type !== "consent" ? <p id={descId} className="pf-desc">{f.description}</p> : null;
  const err = error ? <p id={errId} className="pf-err" role="alert"><AlertCircle aria-hidden="true" />{error}</p> : null;
  const pre = prefilled ? <span className="pf-prefill"><Sparkles aria-hidden="true" />ดึงจากใบสมัคร{readOnly ? " (แก้ไขไม่ได้)" : " — แก้ไขได้"}</span> : null;
  const common = { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, "aria-required": f.required || undefined } as const;
  const str = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";

  if (isChoice(f.type)) {
    const multi = f.type === "multiple_choice";
    const sel = Array.isArray(value) ? (value as string[]) : typeof value === "string" ? [value] : [];
    if (f.type === "dropdown") {
      return (
        <div className="pf-field">
          <label className="pf-label" htmlFor={id}>{label}</label>{desc}
          <div className="pf-control">
            <select {...common} className="pf-select" value={sel[0] ?? ""} onChange={(e) => onChange(e.target.value)}>
              <option value="">กรุณาเลือก</option>
              {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>{err}
        </div>
      );
    }
    return (
      <fieldset className="pf-field" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
        <legend className="pf-label" id={id} tabIndex={-1} style={{ padding: 0 }}>{label}</legend>{desc}
        {multi && <p className="pf-desc">เลือกได้มากกว่า 1 ข้อ</p>}
        <div className="pf-choices">
          {f.options?.map((o) => {
            const checked = sel.includes(o.value);
            return (
              <label key={o.value} className="pf-choice" data-kind={multi ? "multi" : "single"}>
                <input type={multi ? "checkbox" : "radio"} name={f.key} value={o.value} checked={checked}
                  onChange={() => onChange(multi ? (checked ? sel.filter((x) => x !== o.value) : [...sel, o.value]) : o.value)} />
                <span className="pf-mark"><Check aria-hidden="true" /></span><span>{o.label}</span>
              </label>
            );
          })}
        </div>{err}
      </fieldset>
    );
  }
  if (f.type === "checkbox" || f.type === "consent") {
    // Consent with its own confirmation text: question as heading, the text beside the box. Otherwise the question sits beside the box.
    const split = f.type === "consent" && !!f.description;
    return (
      <div className="pf-field">
        {split && <span className="pf-label" id={`${id}-q`}>{label}</span>}
        <label className="pf-consent">
          <input {...common} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)}
            aria-describedby={[split ? `${id}-q` : null, !split && f.description ? descId : null, errId].filter(Boolean).join(" ") || undefined} />
          <span className="pf-mark"><Check aria-hidden="true" /></span>
          <span>{split ? f.description : <>{f.label}{f.required && <span className="pf-req" aria-hidden="true">*</span>}</>}</span>
        </label>
        {!split && f.description && <p id={descId} className="pf-desc">{f.description}</p>}
        {err}
      </div>
    );
  }
  if (isFileType(f.type)) {
    return <FileInput f={f} id={id} label={label} desc={desc} err={err} value={Array.isArray(value) ? (value as Upload[]) : []} onChange={onChange}
      formId={formId} token={token} preview={preview} uploading={uploading} setUploading={setUploading} />;
  }
  const max = f.validation?.maxLength ?? (f.type === "long_text" ? 2000 : f.type === "short_text" ? 200 : undefined);
  const attrs: Record<string, unknown> = {};
  if (f.type === "phone") Object.assign(attrs, { type: "tel", inputMode: "tel", autoComplete: f.mapsTo === "applicant.phone" ? "tel" : "off" });
  else if (f.type === "email") Object.assign(attrs, { type: "email", inputMode: "email", autoComplete: "email", autoCapitalize: "none" });
  else if (f.type === "url") Object.assign(attrs, { type: "url", inputMode: "url", autoCapitalize: "none", autoCorrect: "off", spellCheck: false });
  else if (f.type === "number") Object.assign(attrs, { type: "text", inputMode: "numeric", autoComplete: "off" });
  else if (f.type === "date") Object.assign(attrs, { type: "date", min: f.validation?.notPast ? bangkokTodayIso() : undefined });
  else if (f.type === "time") Object.assign(attrs, { type: "time", step: 300 });
  else Object.assign(attrs, { type: "text", autoComplete: f.mapsTo === "applicant.full_name" ? "name" : f.mapsTo === "applicant.creator_name" ? "nickname" : "off" });
  return (
    <div className="pf-field">
      <label className="pf-label" htmlFor={id}>{label}</label>{desc}
      <div className="pf-control">
        {f.type === "long_text" ? (
          <textarea {...common} className="pf-textarea" value={str} placeholder={f.placeholder} readOnly={readOnly} rows={4}
            onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input {...common} {...attrs} className="pf-input" value={str} placeholder={f.placeholder} readOnly={readOnly} enterKeyHint="next"
            onChange={(e) => onChange(e.target.value)} />
        )}
      </div>
      {f.type === "long_text" && max && <div className={`pf-counter${str.length > max ? " over" : ""}`} aria-live="polite">{str.length.toLocaleString("en-US")}/{max.toLocaleString("en-US")}</div>}
      {pre}{err}
    </div>
  );
}

/** Downscale large photos before upload (phones produce 3–8 MB images). PDFs are sent as-is. */
async function shrink(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

function FileInput({ f, id, label, desc, err, value, onChange, formId, token, preview, uploading, setUploading }: {
  f: Field; id: string; label: React.ReactNode; desc: React.ReactNode; err: React.ReactNode; value: Upload[]; onChange: (v: AnswerValue) => void;
  formId: string; token?: string; preview: boolean; uploading: Pending[]; setUploading: (fn: (l: Pending[]) => Pending[]) => void;
}) {
  const max = f.validation?.maxFiles ?? 1;
  const sizeMb = f.validation?.maxSizeMb ?? 5;
  const acceptImg = f.type === "image" || (f.validation?.accept ?? ["image", "pdf"]).includes("image");
  const acceptPdf = f.type === "file" && (f.validation?.accept ?? ["image", "pdf"]).includes("pdf");
  const accept = [acceptImg ? "image/jpeg,image/png,image/webp" : "", acceptPdf ? "application/pdf" : ""].filter(Boolean).join(",");
  const valueRef = useRef(value);
  valueRef.current = value;
  const room = max - value.length - uploading.filter((u) => !u.error).length;

  async function send(file: File, tmp: string) {
    setUploading((l) => l.map((x) => (x.tmp === tmp ? { tmp, name: file.name, file } : x)));
    if (preview) { setUploading((l) => l.map((x) => (x.tmp === tmp ? { ...x, error: "โหมดตัวอย่างไม่อัปโหลดไฟล์" } : x))); return; }
    try {
      const small = await shrink(file);
      if (small.size > sizeMb * 1024 * 1024) throw new Error(`ไฟล์ใหญ่เกิน ${sizeMb} MB`);
      const fd = new FormData();
      fd.append("form_id", formId); fd.append("field", f.key); fd.append("file", small);
      if (token) fd.append("token", token);
      const res = await fetch("/api/public/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({ error: "อัปโหลดไม่สำเร็จ" }));
      if (!res.ok) throw new Error(data.error || "อัปโหลดไม่สำเร็จ");
      const up: Upload = { id: data.id, claim: data.claim, name: data.name, size: data.size, mime: data.mime, preview: small.type.startsWith("image/") ? URL.createObjectURL(small) : undefined };
      onChange([...valueRef.current, up]);
      setUploading((l) => l.filter((x) => x.tmp !== tmp));
    } catch (e) {
      setUploading((l) => l.map((x) => (x.tmp === tmp ? { ...x, error: (e as Error).message || "อัปโหลดไม่สำเร็จ กรุณาลองใหม่" } : x)));
    }
  }
  function pick(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list).slice(0, Math.max(0, room));
    for (const file of files) {
      const tmp = `${Date.now()}-${Math.random()}`;
      const okType = (acceptImg && /^image\//.test(file.type)) || (acceptPdf && file.type === "application/pdf");
      if (!okType) { setUploading((l) => [...l, { tmp, name: file.name, error: f.type === "image" ? "รองรับเฉพาะรูป JPG, PNG หรือ WebP" : "ชนิดไฟล์ไม่รองรับ" }]); continue; }
      setUploading((l) => [...l, { tmp, name: file.name, file }]);
      void send(file, tmp);
    }
  }
  return (
    <div className="pf-field">
      <span className="pf-label" id={`${id}-l`}>{label}</span>{desc}
      {room > 0 && (
        <label className="pf-drop">
          <input id={id} type="file" accept={accept} multiple={max > 1} aria-labelledby={`${id}-l`} onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
          {f.type === "image" ? <ImagePlus aria-hidden="true" /> : <Upload aria-hidden="true" />}
          <span>{f.type === "image" ? "แตะเพื่อเลือกรูป" : "แตะเพื่อเลือกไฟล์"}</span>
          <small>{[acceptImg && "JPG/PNG/WebP", acceptPdf && "PDF"].filter(Boolean).join(" · ")} · ไม่เกิน {sizeMb} MB{max > 1 ? ` · สูงสุด ${max} ไฟล์` : ""}</small>
        </label>
      )}
      {(value.length > 0 || uploading.length > 0) && (
        <ul className="pf-files">
          {value.map((u) => (
            <li key={u.id} className="pf-file">
              <span className="pf-thumb">{u.preview ? <img src={u.preview} alt="" /> : u.mime.startsWith("image/") ? <ImagePlus aria-hidden="true" /> : <FileText aria-hidden="true" />}</span>
              <span style={{ minWidth: 0 }}><b>{u.name}</b><small>{fmtSize(u.size)} · อัปโหลดแล้ว</small></span>
              <span className="pf-file-act"><button type="button" className="pf-mini danger" aria-label={`ลบไฟล์ ${u.name}`} onClick={() => onChange(value.filter((x) => x.id !== u.id))}><Trash2 aria-hidden="true" /></button></span>
            </li>
          ))}
          {uploading.map((u) => (
            <li key={u.tmp} className="pf-file">
              <span className="pf-thumb">{u.error ? <AlertCircle aria-hidden="true" /> : <Loader2 className="spin" aria-hidden="true" style={{ animation: "pf-spin 1s linear infinite" }} />}</span>
              <span style={{ minWidth: 0 }}><b>{u.name}</b>{u.error ? <small className="bad" role="alert">{u.error}</small> : <small>กำลังอัปโหลด…</small>}</span>
              <span className="pf-file-act">
                {u.error && u.file && <button type="button" className="pf-mini" aria-label="ลองอัปโหลดอีกครั้ง" onClick={() => void send(u.file!, u.tmp)}><RotateCcw aria-hidden="true" /></button>}
                {u.error && <button type="button" className="pf-mini danger" aria-label="นำออก" onClick={() => setUploading((l) => l.filter((x) => x.tmp !== u.tmp))}><Trash2 aria-hidden="true" /></button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {err}
    </div>
  );
}
