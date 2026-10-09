export type Address = { port: number; path: string };

const local = /^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])?:(\d{1,5})(\/.*)?$/i;

function normalizePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function validPort(value: number) {
  return Number.isInteger(value) && value > 0 && value <= 65535;
}

export function parseAddress(input: string, currentPort: number | null): Address | null {
  const value = input.trim();
  if (!value) return null;
  if (/^\d{1,5}$/.test(value)) {
    const port = Number(value);
    return validPort(port) ? { port, path: "/" } : null;
  }
  const withHost = value.match(/^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::(\d{1,5}))?(\/.*)?$/i);
  if (withHost) {
    const port = withHost[1] ? Number(withHost[1]) : 80;
    return validPort(port) ? { port, path: normalizePath(withHost[2] ?? "/") } : null;
  }
  const bare = value.match(local);
  if (bare) {
    const port = Number(bare[1]);
    return validPort(port) ? { port, path: normalizePath(bare[2] ?? "/") } : null;
  }
  if (/^https?:\/\//i.test(value)) return null;
  const path = value.replace(/^\.?\//, "");
  if (/\.html?([?#].*)?$/i.test(path) && !value.startsWith("/")) return { port: 0, path: `/${path}` };
  if (value.startsWith("/") && currentPort !== null) return { port: currentPort, path: value };
  if (currentPort !== null && currentPort > 0) return { port: currentPort, path: normalizePath(value) };
  if (currentPort === 0) return { port: 0, path: normalizePath(value) };
  return null;
}

export function formatAddress(address: Address) {
  if (address.port === 0) return address.path.replace(/^\//, "");
  return `localhost:${address.port}${address.path === "/" ? "" : address.path}`;
}

export function agentAddress(url: string): Address | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol === "file:") {
    const path = decodeURIComponent(parsed.pathname);
    return path.startsWith("/workspace/") ? { port: 0, path: path.slice("/workspace".length) + parsed.search + parsed.hash } : null;
  }
  if ((parsed.protocol === "http:" || parsed.protocol === "https:") && /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(parsed.hostname)) {
    const port = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
    return { port, path: `${parsed.pathname}${parsed.search}${parsed.hash}` };
  }
  return null;
}

export function displayUrl(url: string) {
  const local = agentAddress(url);
  if (local) return formatAddress(local);
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
