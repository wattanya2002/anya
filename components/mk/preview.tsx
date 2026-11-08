"use client";
import { useEffect, useState } from "react";
import { Eye, ImageOff, Maximize2, Minimize2, Minus, RotateCcw, X } from "lucide-react";

export type PreviewImage = { id: string; url: string; label: string };
type Mode = "normal" | "min" | "max" | "closed";

function Img({ img, className }: { img: PreviewImage; className?: string }) {
  const [failed, setFailed] = useState(false);
  const [n, setN] = useState(0);
  if (failed) {
    return (
      <span className="ap-pv-fail" role="img" aria-label={`โหลดภาพ ${img.label} ไม่ได้`}>
        <ImageOff aria-hidden="true" />โหลดภาพไม่ได้
        <button type="button" className="ap-btn white h44" style={{ flex: "0 0 auto" }} onClick={(e) => { e.stopPropagation(); setFailed(false); setN((x) => x + 1); }}>
          <RotateCcw aria-hidden="true" />ลองโหลดใหม่
        </button>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- user-supplied https URLs of any host; next/image needs a fixed allow-list
  return <img key={n} src={img.url} alt={img.label} className={className ?? "ap-img"} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function Controls({ mode, set, labels }: { mode: Mode; set: (m: Mode) => void; labels?: { close?: string } }) {
  return (
    <div className="ap-wwdc" role="group" aria-label="ควบคุมพรีวิว">
      <button type="button" className="close" aria-label={labels?.close ?? "ปิดพรีวิว"} title="ปิด" onClick={() => set("closed")}><span><X aria-hidden="true" /></span></button>
      {mode === "min"
        ? <button type="button" className="min" aria-label="คืนขนาดพรีวิว" title="คืนขนาด" onClick={() => set("normal")}><span><Minimize2 aria-hidden="true" /></span></button>
        : <button type="button" className="min" aria-label="ย่อพรีวิวเหลือแถบหัว" title="ย่อ" onClick={() => set("min")}><span><Minus aria-hidden="true" /></span></button>}
      {mode === "max"
        ? <button type="button" className="max" aria-label="คืนขนาดพรีวิวปกติ" title="คืนขนาด" onClick={() => set("normal")}><span><Minimize2 aria-hidden="true" /></span></button>
        : <button type="button" className="max" aria-label="ขยายพรีวิวเต็มจอ" title="ขยาย" onClick={() => set("max")}><span><Maximize2 aria-hidden="true" /></span></button>}
    </div>
  );
}

/** Ad-image preview with window-style controls: close, minimize to a header bar, expand to full screen (approved canvas 02 / 02b / 02c).
 *  The mode is remembered per request for this browser tab so returning to the request keeps the reviewer's choice. */
export function Preview({ requestKey, images, title, refNo, status }: { requestKey: string; images: PreviewImage[]; title: string; refNo: string; status: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("normal");
  const [idx, setIdx] = useState(0);
  const storeKey = `ap-preview:${requestKey}`;

  useEffect(() => {
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(storeKey); } catch { /* storage unavailable */ }
    // Restoring a remembered choice is a one-time sync with sessionStorage after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "min" || saved === "closed") setModeState(saved);
  }, [storeKey]);

  useEffect(() => {
    const open = (e: Event) => { setIdx(Number((e as CustomEvent).detail) || 0); setModeState("max"); };
    window.addEventListener("ap:preview", open);
    return () => window.removeEventListener("ap:preview", open);
  }, []);

  useEffect(() => {
    if (mode !== "max") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModeState("normal");
      if (e.key === "ArrowRight") setIdx((i) => Math.min(images.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, images.length]);

  const set = (m: Mode) => {
    setModeState(m);
    try { if (m === "max") return; sessionStorage.setItem(storeKey, m); } catch { /* storage unavailable */ }
  };
  if (!images.length) return null;
  const cur = images[Math.min(idx, images.length - 1)];
  const count = `${Math.min(idx, images.length - 1) + 1}/${images.length}`;

  if (mode === "closed") {
    return <button type="button" className="ap-pv-show" onClick={() => set("normal")}><Eye aria-hidden="true" />แสดงพรีวิวภาพ ({images.length})</button>;
  }
  if (mode === "min") {
    return (
      <div className="ap-pv-min">
        <button type="button" onClick={() => set("normal")} aria-label="คืนขนาดพรีวิว">
          <span className="thumb"><Img img={cur} /></span>
          <span style={{ minWidth: 0 }}><b>พรีวิวภาพ</b><small>{count} · {status}</small></span>
        </button>
        <Controls mode="min" set={set} />
      </div>
    );
  }
  return (
    <>
      <div className="ap-pv-row">
        <div>พรีวิวภาพ · {count}</div>
        <Controls mode="normal" set={set} />
      </div>
      <div className="ap-pv-stack">
        <button type="button" onClick={() => set("max")} aria-label={`ขยายภาพ ${cur.label} เต็มจอ`}><Img img={cur} /></button>
      </div>
      <div className="ap-pv-open"><button type="button" onClick={() => set("max")}><Eye aria-hidden="true" />ดูตัวอย่างเต็ม</button></div>
      {mode === "max" && (
        <div className="ap-pv-max" role="dialog" aria-modal="true" aria-label="พรีวิวภาพเต็มจอ">
          <div className="ap-col" style={{ display: "flex", flexDirection: "column", flex: "1 1 auto" }}>
            <div className="ap-pv-max-top">
              <Controls mode="max" set={(m) => set(m === "closed" ? "normal" : m)} labels={{ close: "ปิดพรีวิว กลับไปที่คำขอตำแหน่งเดิม" }} />
              <span className="ap-pv-count">{count.replace("/", " / ")}</span>
            </div>
            <div className="ap-pv-max-title">
              <span style={{ minWidth: 0 }}><b>พรีวิวภาพ</b><small>{refNo} · {title}</small></span>
              {status}
            </div>
            <div className="ap-pv-big"><Img img={cur} className="" /></div>
            <p className="ap-pv-cap">ภาพที่ {Math.min(idx, images.length - 1) + 1} · {cur.label}</p>
            {images.length > 1 && (
              <div className="ap-pv-thumbs">
                {images.map((im, i) => (
                  <button key={im.id} type="button" aria-label={`ภาพที่ ${i + 1} ${im.label}`} aria-current={i === idx ? "true" : "false"} onClick={() => setIdx(i)}>
                    <Img img={im} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Thumbnail in the request body that opens the full-screen preview at its index. */
export function PreviewThumb({ img, index }: { img: PreviewImage; index: number }) {
  return (
    <button type="button" className="ap-thumb" onClick={() => window.dispatchEvent(new CustomEvent("ap:preview", { detail: index }))} aria-label={`ดูภาพ ${img.label} เต็มจอ`}>
      <Img img={img} />
      <span>{img.label}</span>
    </button>
  );
}
