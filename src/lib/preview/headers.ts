const appCookie = /^(__Secure-|__Host-)?(better-auth[.-]|seedling[._-]|__seedling)/i;

export function forwardedCookie(cookie: string | undefined) {
  return (cookie ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !appCookie.test(part.split("=")[0]))
    .join("; ");
}

export function withoutFrameAncestors(csp: string | string[] | undefined) {
  return (Array.isArray(csp) ? csp : csp ? [csp] : [])
    .map((policy) =>
      policy
        .split(";")
        .map((d) => d.trim())
        .filter((d) => d && !/^frame-ancestors\b/i.test(d))
        .join("; "),
    )
    .filter(Boolean);
}

export function rewriteLocation(location: string, port: number) {
  const match = location.match(/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/.*)?$/i);
  if (!match) return location;
  if (match[2] && match[2] !== `:${port}`) return location;
  return match[3] ?? "/";
}

export function rewriteSetCookie(cookie: string) {
  return cookie
    .split(";")
    .filter((part) => !/^\s*domain=/i.test(part))
    .join(";");
}

export function safePath(raw: string) {
  const value = raw.trim() || "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return `/${value.replace(/^[/\\]+/, "")}`;
  return value;
}
