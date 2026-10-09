const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function originOf(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function sameApp(origin: string | undefined, host: string | undefined, appUrl: string) {
  if (!origin) return true;
  const parsed = originOf(origin);
  if (!parsed) return false;
  if (parsed === originOf(appUrl)) return true;
  return Boolean(host) && new URL(parsed).host === host;
}

export function crossSiteWriteBlocked(input: { method?: string; path: string; origin?: string; fetchSite?: string; host?: string; appUrl: string }) {
  if (SAFE_METHODS.has((input.method ?? "GET").toUpperCase())) return false;
  if (input.path.startsWith("/api/gateway/")) return false;
  if (input.origin) return !sameApp(input.origin, input.host, input.appUrl);
  return input.fetchSite === "cross-site" || input.fetchSite === "same-site";
}

export function upgradeAllowed(origin: string | undefined, host: string | undefined, appUrl: string) {
  return sameApp(origin, host, appUrl);
}

export function blockedPath(path: string) {
  return path === "/_next/image";
}
