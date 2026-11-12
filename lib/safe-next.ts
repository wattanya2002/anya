/**
 * Where to go after sign-in: only a path on this site. Anything that could leave the site
 * (another host, a scheme, "//", backslashes, control characters) or loop back to sign-in is refused.
 */
export function safeNext(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length < 2 || s.length > 512) return null;
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(s)) return null;
  if (/^\/sign-in(?:[/?#]|$)/.test(s)) return null;
  try {
    if (new URL(s, "http://site.invalid").host !== "site.invalid") return null;
  } catch {
    return null;
  }
  return s;
}
