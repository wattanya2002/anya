/* eslint-disable @next/next/no-img-element -- photos come from Postgres through our own route (/api/kol/files); next/image would need a custom loader */
"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { applicantRef, initials, type CeoTab } from "@/lib/kol-core";
import { SocialPair, type SocialLite } from "./people";
import { ceoHref, DecidedLine, DecisionLinks, type DecidedInfo } from "./ceo-ui";

export type Slide = { id: string; name: string; refNo: number; photo: string | null; social: SocialLite[]; campaign: string; pending: boolean; decided: DecidedInfo };

/** CEO master card (Master RCM §5): photo 70% fading into white, info 30%, three round decisions. Swipe or use the arrows for the next KOL. */
export function CeoCarousel({ slides, index, tab, canDecide, sub }: { slides: Slide[]; index: number; tab: CeoTab; canDecide: boolean; sub: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(index);
  const total = slides.length;

  const go = useCallback((i: number, smooth = true) => {
    const t = track.current, el = t?.children[i] as HTMLElement | undefined;
    if (t && el) t.scrollTo({ left: el.offsetLeft, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => { go(index, false); }, [go, index]);

  // which card is centred → counter, dots and the address (refresh keeps the same KOL)
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = (t.children[0] as HTMLElement | undefined)?.offsetWidth ?? t.clientWidth;
        const i = Math.min(total - 1, Math.max(0, Math.round(t.scrollLeft / (w + 16))));
        setCur((prev) => {
          if (prev !== i) window.history.replaceState(window.history.state, "", ceoHref.card(slides[i].id, tab));
          return i;
        });
      });
    };
    t.addEventListener("scroll", onScroll, { passive: true });
    return () => { t.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [slides, tab, total]);

  const s = slides[cur] ?? slides[0];
  const from = Math.max(0, Math.min(cur - 3, total - 7)), dots = Array.from({ length: Math.min(total, 7) }, (_, k) => from + k);
  return (
    <div className="k-mc-wrap">
      <div className="k-head">
        <div className="k-ph">
          <Link href={ceoHref.queue(tab)} className="k-back-btn" aria-label="กลับคิว CEO Approval"><ChevronLeft aria-hidden="true" /></Link>
          <div className="k-ph-t"><h1>CEO Approval</h1><p>{sub}</p></div>
          <span className="k-pill" aria-label={`รายการที่ ${cur + 1} จาก ${total}`}><b>{cur + 1}</b> / {total}</span>
        </div>
      </div>

      <div className="k-mc-stage" onKeyDown={(e) => { if (e.key === "ArrowRight" && cur < total - 1) go(cur + 1); if (e.key === "ArrowLeft" && cur > 0) go(cur - 1); }}>
        {total > 1 && <button type="button" className="k-mc-nav prev" onClick={() => go(cur - 1)} disabled={cur === 0} aria-label="KOL ก่อนหน้า"><ChevronLeft aria-hidden="true" /></button>}
        <div ref={track} className="k-mc-track" style={{ position: "relative" }} aria-roledescription="carousel" aria-label="การ์ด KOL รอพิจารณา">
          {slides.map((x, i) => (
            <article key={x.id} className="k-mc" aria-roledescription="slide" aria-label={`${i + 1} จาก ${total}: ${x.name}`} aria-hidden={i !== cur ? "true" : undefined} data-current={i === cur}>
              <Link href={ceoHref.hub(x.id, tab)} className="k-mc-main" tabIndex={i === cur ? 0 : -1} aria-label={`ดูรายละเอียด ${x.name} ${applicantRef(x.refNo)}`}>
                <div className="k-mc-photo">{x.photo ? <img src={`/api/kol/files/${x.photo}`} alt="" loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"} /> : <span aria-hidden="true">{initials(x.name)}</span>}</div>
                <div className="k-mc-info">
                  <h2 className="k-mc-name"><b>{x.name}</b><span className="k-code">{applicantRef(x.refNo)}</span></h2>
                  <SocialPair social={x.social} />
                  <div className="k-camp"><Megaphone aria-hidden="true" /><span>{x.campaign}</span></div>
                </div>
              </Link>
              {x.pending && canDecide ? (
                <div className="k-mc-acts" inert={i !== cur ? true : undefined}><DecisionLinks id={x.id} tab={tab} name={x.name} /></div>
              ) : x.decided ? (
                <div className="k-mc-done" data-s={x.decided.decision} role="status"><DecidedLine d={x.decided} /></div>
              ) : (
                <div className="k-mc-done" data-s="view">รอ CEO พิจารณา — ตัดสินใจได้เฉพาะ CEO</div>
              )}
            </article>
          ))}
        </div>
        {total > 1 && <button type="button" className="k-mc-nav next" onClick={() => go(cur + 1)} disabled={cur === total - 1} aria-label="KOL ถัดไป"><ChevronRight aria-hidden="true" /></button>}
      </div>

      {total > 1 && <div className="k-dots" aria-hidden="true">{dots.map((d) => <i key={d} data-on={d === cur} />)}</div>}
      <p className="sr-only" aria-live="polite">{`รายการที่ ${cur + 1} จาก ${total}: ${s.name}`}</p>
    </div>
  );
}
