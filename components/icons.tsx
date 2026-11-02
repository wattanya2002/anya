import type { SVGProps } from "react";

/** Brand mark: pink ball with white seams (provisional until the official logo is supplied). */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="wc-ball" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb9dbb" />
          <stop offset="1" stopColor="#ee6496" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="url(#wc-ball)" />
      <path d="M9 7.5c6.5 4.5 9 12.5 6 21.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity=".95" />
      <path d="M33 11c-6.4 3-9.6 10.6-7.6 22" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity=".95" />
    </svg>
  );
}

/** Outline ball icon used for the courts rail item (Lucide stroke conventions). */
export function CourtBall(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M6 5.2c2.6 2.2 3.8 5 3.6 8.2-.1 2-.9 3.8-2.4 5.4" />
      <path d="M18 5.2c-2.6 2.2-3.8 5-3.6 8.2.1 2 .9 3.8 2.4 5.4" />
    </svg>
  );
}
