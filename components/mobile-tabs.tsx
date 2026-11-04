"use client";
import { useState } from "react";

export type MobileTab = { id: string; label: string; icon?: React.ReactNode; badge?: number };

/**
 * iPhone (<768px) card tabs — review decision "แท็บสลับการ์ด": every page fits one screen and
 * only the chosen card is shown; its content scrolls inside the card.
 *
 * Place <MobileTabs scope="x" …/> inside the element marked data-mscope="x". Sibling elements opt in
 * with data-tab="<id>" (space-separated ids allowed). Elements marked data-tab-host are hidden when
 * none of their descendants belongs to the active tab. On PC / iPad the tab bar is display:none and
 * the generated rules are scoped to the phone media query, so the grid layout is untouched.
 */
/** `compact`: icon-only tabs (label kept for screen readers and as a tooltip). */
export function MobileTabs({ scope, tabs, defaultTab, label, compact = false }: { scope: string; tabs: MobileTab[]; defaultTab?: string; label: string; compact?: boolean }) {
  const initial = defaultTab && tabs.some((t) => t.id === defaultTab) ? defaultTab : tabs[0]?.id ?? "";
  const [state, setState] = useState({ base: initial, active: initial });
  // A new default (e.g. opening the edit form via a link) switches to that tab.
  if (state.base !== initial) setState({ base: initial, active: initial });
  const active = state.base !== initial ? initial : state.active;
  const s = `[data-mscope="${scope}"]`;
  const css = `@media screen and (max-width: 767px){${s} [data-tab]:not([data-tab~="${active}"]){display:none!important}${s} [data-tab-host]:not(:has([data-tab~="${active}"])){display:none!important}}`;

  function select(id: string) { setState({ base: initial, active: id }); }
  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    select(next.id);
    document.getElementById(`mtab-${scope}-${next.id}`)?.focus();
  }

  return (
    <>
      <style>{css}</style>
      <div className={`mtab-bar${compact ? " compact" : ""}`} role="tablist" aria-label={label} style={{ ["--mtab-n" as string]: tabs.length }}>
        {tabs.map((t, i) => (
          <button key={t.id} id={`mtab-${scope}-${t.id}`} type="button" role="tab" aria-selected={t.id === active}
            tabIndex={t.id === active ? 0 : -1} onClick={() => select(t.id)} onKeyDown={(e) => onKey(e, i)} title={compact ? t.label : undefined}>
            {compact && t.icon ? <>{t.icon}<span className="sr-only">{t.label}</span></> : t.label}
            {t.badge ? <b className="mtab-badge" aria-hidden="true">{t.badge}</b> : null}
          </button>
        ))}
      </div>
    </>
  );
}
