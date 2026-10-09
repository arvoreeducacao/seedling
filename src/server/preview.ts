import http from "node:http";
import type net from "node:net";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, ready, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { sandbox } from "@/lib/sandbox";
import { remainingMs, workspaceDir, type Session } from "@/lib/sessions";
import { PREVIEW_COOKIE, passLifetime, previewPortAllowed, signer } from "@/lib/preview";
import { BRIDGE_PATH, bridgeScript, injectBridge } from "@/lib/preview/bridge";
import { mimeOf } from "@/lib/preview/mime";
import { OutsideError, readInside, statInside } from "@/lib/safe-path";
import { forwardedCookie, rewriteLocation, rewriteSetCookie, safePath, withoutFrameAncestors } from "@/lib/preview/headers";

const previewHost = env.previewOrigin ? new URL(env.previewOrigin).host : "";
const secure = env.previewOrigin.startsWith("https://");
const ENTER_PATH = "/__seedling/enter";
const MAX_INJECT = 5 * 1024 * 1024;
const MAX_FILE = 25 * 1024 * 1024;

export function isPreviewHost(req: http.IncomingMessage) {
  return Boolean(previewHost) && req.headers.host === previewHost;
}

function cookieOf(req: http.IncomingMessage, name: string) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function baseHeaders(): Record<string, string> {
  return {
    "content-security-policy": `frame-ancestors ${env.url}`,
    "x-robots-tag": "noindex, nofollow",
    "cache-control": "no-store",
  };
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function notice(res: http.ServerResponse, status: number, title: string, detail: string) {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(status, { ...baseHeaders(), "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#0e0f2d;color:#babcd9;font:13px/1.6 ui-sans-serif,system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}b{display:block;color:#eceefb;font-weight:500;font-size:14px;margin-bottom:6px}</style></head><body><div><b>${escapeHtml(title)}</b>${escapeHtml(detail)}</div><script src="${BRIDGE_PATH}"></script></body></html>`);
}

type Resolved = { session: Session; containerId: string | null };
const resolvedCache = new Map<string, { at: number; value: Resolved | null }>();

async function resolveSession(sessionId: string): Promise<Resolved | null> {
  const hit = resolvedCache.get(sessionId);
  if (hit && Date.now() - hit.at < 3000) return hit.value;
  await ready();
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) });
  const value = session && session.status === "running" ? { session, containerId: await sandbox().find(session.id).catch(() => null) } : null;
  resolvedCache.set(sessionId, { at: Date.now(), value });
  if (resolvedCache.size > 500) resolvedCache.delete(resolvedCache.keys().next().value!);
  return value;
}

const agents = new Map<string, http.Agent>();

function agentFor(containerId: string, port: number) {
  const key = `${containerId}:${port}`;
  let agent = agents.get(key);
  if (!agent) {
    agent = new http.Agent({ keepAlive: true, maxSockets: 8, maxFreeSockets: 4, timeout: 30_000 });
    agent.createConnection = ((_options: unknown, done: (error: Error | null, socket?: net.Socket) => void) => {
      sandbox()
        .connect(containerId, port)
        .then((socket) => done(null, socket as unknown as net.Socket), (error: Error) => done(error));
      return undefined;
    }) as unknown as http.Agent["createConnection"];
    agents.set(key, agent);
    if (agents.size > 200) {
      const [oldest, stale] = agents.entries().next().value!;
      stale.destroy();
      agents.delete(oldest);
    }
  }
  return agent;
}

function upstreamHeaders(req: http.IncomingMessage, port: number) {
  const headers: http.OutgoingHttpHeaders = { ...req.headers, host: `localhost:${port}`, "accept-encoding": "identity" };
  const cookie = forwardedCookie(req.headers.cookie);
  if (cookie) headers.cookie = cookie;
  else delete headers.cookie;
  if (req.headers.origin) headers.origin = `http://localhost:${port}`;
  if (typeof req.headers.referer === "string") {
    try {
      const ref = new URL(req.headers.referer);
      headers.referer = `http://localhost:${port}${ref.pathname}${ref.search}`;
    } catch {
      delete headers.referer;
    }
  }
  return headers;
}

function responseHeaders(up: http.IncomingMessage, port: number) {
  const headers: http.OutgoingHttpHeaders = { ...up.headers };
  delete headers["x-frame-options"];
  const csp = withoutFrameAncestors(up.headers["content-security-policy"]);
  headers["content-security-policy"] = [...csp, `frame-ancestors ${env.url}`].join(", ");
  headers["x-robots-tag"] = "noindex, nofollow";
  if (typeof up.headers.location === "string") headers.location = rewriteLocation(up.headers.location, port);
  if (up.headers["set-cookie"]) headers["set-cookie"] = up.headers["set-cookie"].map(rewriteSetCookie);
  return headers;
}

function relay(req: http.IncomingMessage, res: http.ServerResponse, containerId: string, port: number) {
  const upstream = http.request({ agent: agentFor(containerId, port), host: "localhost", port, method: req.method, path: req.url, headers: upstreamHeaders(req, port) }, (up) => {
    const headers = responseHeaders(up, port);
    const html = /text\/html/i.test(String(up.headers["content-type"] ?? "")) && !up.headers["content-encoding"] && req.method === "GET";
    if (!html) {
      res.writeHead(up.statusCode ?? 502, headers);
      up.pipe(res);
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    up.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_INJECT) chunks.push(chunk);
    });
    up.on("end", () => {
      const body = size <= MAX_INJECT ? Buffer.from(injectBridge(Buffer.concat(chunks).toString("utf8"))) : Buffer.concat(chunks);
      delete headers["transfer-encoding"];
      headers["content-length"] = String(body.length);
      res.writeHead(up.statusCode ?? 200, headers);
      res.end(body);
    });
    up.on("error", () => notice(res, 502, "The page stopped responding", "The app closed the connection."));
  });
  upstream.setTimeout(60_000, () => upstream.destroy(new Error("timeout")));
  upstream.on("error", () => notice(res, 502, `Nothing is answering on port ${port}`, "Start the dev server in the terminal, then reload."));
  req.pipe(upstream);
}

function decoded(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

async function serveFile(req: http.IncomingMessage, res: http.ServerResponse, session: Session) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    notice(res, 405, "Read only", "Workspace files open as static pages.");
    return;
  }
  const root = path.resolve(workspaceDir(session.id, session.currentIndex));
  const pathname = safePath(new URL(req.url ?? "/", "http://preview").pathname);
  let relative = decoded(pathname).replace(/^\/+/, "");
  const entry = await statInside(root, relative).catch((error: unknown) => (error instanceof OutsideError ? "outside" : null));
  if (entry === "outside") {
    notice(res, 404, "Not found", pathname);
    return;
  }
  if (entry?.stat.isDirectory()) relative = path.join(relative, "index.html");
  const file = await readInside(root, relative, MAX_FILE).catch(() => null);
  if (!file) {
    notice(res, 404, "File not found", relative || "/");
    return;
  }
  if (!file.buffer) {
    notice(res, 413, "File too large", "Open it from the Files panel instead.");
    return;
  }
  const target = file.target;
  const type = mimeOf(target);
  let body: Buffer = file.buffer;
  if (type.startsWith("text/html")) body = Buffer.from(injectBridge(body.toString("utf8")));
  res.writeHead(200, { ...baseHeaders(), "content-type": type, "content-length": String(body.length), "x-content-type-options": "nosniff" });
  res.end(req.method === "HEAD" ? undefined : body);
}

async function enter(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? "/", "http://preview");
  const ticket = signer().verify(url.searchParams.get("ticket"), "ticket");
  if (!ticket) {
    notice(res, 401, "This preview link expired", "Open the page again from the workspace.");
    return;
  }
  const port = Number(url.searchParams.get("port") ?? 0);
  if (!previewPortAllowed(port)) {
    notice(res, 400, "Invalid port", String(url.searchParams.get("port")));
    return;
  }
  const found = await resolveSession(ticket.session);
  if (!found) {
    notice(res, 404, "The session is not running", "Pages open only while the session is live.");
    return;
  }
  const lifetime = passLifetime(remainingMs(found.session));
  const pass = signer().sign({ kind: "pass", session: ticket.session, port, expires: Date.now() + lifetime });
  const attributes = ["Path=/", "HttpOnly", `Max-Age=${Math.floor(lifetime / 1000)}`, secure ? "SameSite=None; Secure; Partitioned" : "SameSite=Lax"];
  res.writeHead(302, { ...baseHeaders(), location: safePath(url.searchParams.get("path") ?? "/"), "set-cookie": `${PREVIEW_COOKIE}=${pass}; ${attributes.join("; ")}` });
  res.end();
}

export async function handlePreview(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const pathname = (req.url ?? "/").split("?")[0];
    if (pathname === ENTER_PATH) return await enter(req, res);
    if (pathname === BRIDGE_PATH) {
      res.writeHead(200, { ...baseHeaders(), "content-type": "text/javascript; charset=utf-8" });
      res.end(bridgeScript(env.url));
      return;
    }
    const pass = signer().verify(cookieOf(req, PREVIEW_COOKIE), "pass");
    if (!pass) return notice(res, 401, "Open this page from the workspace", "Preview links are tied to a live session and expire on their own.");
    const found = await resolveSession(pass.session);
    if (!found) return notice(res, 404, "The session is not running", "Pages open only while the session is live.");
    if (pass.port === 0) return await serveFile(req, res, found.session);
    if (!previewPortAllowed(pass.port)) return notice(res, 403, "This port is not available", String(pass.port));
    if (!found.containerId) return notice(res, 502, "The sandbox is starting", "Try again in a few seconds.");
    relay(req, res, found.containerId, pass.port);
  } catch (error) {
    console.error("[seedling] preview", error);
    notice(res, 502, "Preview unavailable", "Something went wrong opening this page.");
  }
}

export async function handlePreviewUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer) {
  socket.on("error", () => socket.destroy());
  const pass = signer().verify(cookieOf(req, PREVIEW_COOKIE), "pass");
  const found = pass && pass.port > 0 && previewPortAllowed(pass.port) ? await resolveSession(pass.session).catch(() => null) : null;
  if (!pass || !found?.containerId) {
    socket.end("HTTP/1.1 401 Unauthorized\r\nconnection: close\r\n\r\n");
    return;
  }
  const upstream = await sandbox()
    .connect(found.containerId, pass.port)
    .catch(() => null);
  if (!upstream) {
    socket.destroy();
    return;
  }
  const headers = upstreamHeaders(req, pass.port);
  delete headers["accept-encoding"];
  const lines = Object.entries(headers).flatMap(([key, value]) => (value === undefined ? [] : (Array.isArray(value) ? value : [value]).map((v) => `${key}: ${v}`)));
  upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${lines.join("\r\n")}\r\n\r\n`);
  if (head.length) upstream.write(head);
  upstream.pipe(socket);
  socket.pipe(upstream);
  upstream.on("error", () => socket.destroy());
  socket.on("close", () => upstream.destroy());
}
