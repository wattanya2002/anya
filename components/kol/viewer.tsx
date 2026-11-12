/* eslint-disable @next/next/no-img-element -- images come from Postgres through our own route (/api/kol/files) */
"use client";
import { useRef, useState } from "react";
import { X } from "lucide-react";

/** Portfolio images open full screen (Master RCM screen 08). */
export function PortfolioGrid({ files }: { files: { id: string; name: string; tag: string }[] }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<{ id: string; name: string } | null>(null);
  return (
    <>
      <div className="k-port">
        {files.map((f) => (
          <button key={f.id} type="button" onClick={() => { setOpen(f); dlg.current?.showModal(); }} aria-label={`ดู ${f.name} เต็มหน้าจอ`}>
            <img src={`/api/kol/files/${f.id}`} alt={f.name} loading="lazy" /><span className="k-tagl">{f.tag}</span>
          </button>
        ))}
      </div>
      <dialog ref={dlg} className="k-viewer" aria-label={open ? `รูป ${open.name}` : "รูปผลงาน"} onClose={() => setOpen(null)} onClick={(e) => { if (e.target === e.currentTarget) dlg.current?.close(); }}>
        {open && <img src={`/api/kol/files/${open.id}`} alt={open.name} />}
        <button type="button" onClick={() => dlg.current?.close()} aria-label="ปิด"><X aria-hidden="true" /></button>
      </dialog>
    </>
  );
}
