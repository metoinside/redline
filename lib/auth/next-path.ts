// Where to send the buyer after sign-in. Only a same-site relative path is
// accepted, so a crafted link cannot bounce someone to another site.
export const DEFAULT_AFTER_SIGN_IN = "/library";

export function safeNextPath(raw: unknown, fallback: string = DEFAULT_AFTER_SIGN_IN): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  // Must be a path on this site: one leading slash, not "//host" or "/\host".
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Control characters and backslashes can be normalised into a host by browsers.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const base = "https://redline.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    if (url.pathname.startsWith("/sign-in")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
