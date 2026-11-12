/* eslint-disable @next/next/no-img-element -- images come from Postgres through our own routes (/api/kol/files, /api/public/hero) or local blob previews; next/image would need a custom loader */
import { FileText } from "lucide-react";
import { allFields, displayAnswer, isFileType, type Answers, type AnswerValue, type FormSchema } from "@/lib/forms-core";
import type { FileMeta } from "@/lib/forms-server";

/** Read-only answers of one submission, rendered against the form version it was given on (labels of that version). */
export function AnswersView({ schema, answers, files, showEmpty = false }: { schema: FormSchema; answers: Answers; files: Record<string, FileMeta[]>; showEmpty?: boolean }) {
  const fields = allFields(schema);
  const shown = fields.filter((f) => showEmpty || (answers[f.key] !== undefined && answers[f.key] !== null) || files[f.key]?.length);
  const hidden = fields.length - shown.length;
  return (
    <>
      <dl className="k-kv">
        {shown.map((f) => {
          if (isFileType(f.type)) {
            const list = files[f.key] ?? [];
            return (
              <div key={f.key}><dt>{f.label}</dt><dd>
                {list.length === 0 ? <span className="k-muted">—</span> : f.type === "image" || list.every((x) => x.mime.startsWith("image/")) ? (
                  <div className="k-thumbs">{list.map((x) => <a key={x.id} href={`/api/kol/files/${x.id}`} target="_blank" rel="noopener noreferrer" aria-label={`เปิดรูป ${x.name}`}><img src={`/api/kol/files/${x.id}`} alt={x.name} loading="lazy" /></a>)}</div>
                ) : (
                  <ul className="k-files">{list.map((x) => <li key={x.id}><a href={`/api/kol/files/${x.id}`} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" />{x.name}</a></li>)}</ul>
                )}
              </dd></div>
            );
          }
          const v = answers[f.key] as AnswerValue | undefined;
          const txt = displayAnswer(f, v);
          const isUrl = f.type === "url" && typeof v === "string";
          return (
            <div key={f.key}><dt>{f.label}</dt>
              <dd>{txt ? (isUrl ? <a href={v as string} target="_blank" rel="noopener noreferrer">{txt}</a> : txt) : <span className="k-muted">ไม่ได้ตอบ</span>}</dd>
            </div>
          );
        })}
      </dl>
      {hidden > 0 && !showEmpty && <p className="k-muted k-small" style={{ margin: "8px 0 0" }}>อีก {hidden} คำถามไม่ได้ตอบหรือไม่แสดงตามเงื่อนไข</p>}
    </>
  );
}
