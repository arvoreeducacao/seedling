import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { eq } from "drizzle-orm";
import { db, ready, schema } from "@/lib/db";
import { adminFromRequest } from "@/lib/admin-request";
import { CANDIDATE_COOKIE, candidateOwns, castPath, terminalKey } from "@/lib/sessions";
import { MAIN_AGENT, agentCwd, agentShellEnv, isOpenAgent, validAgentKey } from "@/lib/agents";
import { sandbox } from "@/lib/sandbox";
import { bus } from "@/lib/bus";
import { lastOutput, shellResets } from "@/server/terminal-registry";
import { mirrorFor } from "@/server/terminal-mirror";
import { filterInput, trackFocusMode } from "@/server/terminal-input";
import { ensureSandbox } from "@/lib/revive";
import { env } from "@/lib/env";
import { upgradeAllowed } from "@/server/origin";

type Viewer = { kind: "candidate" } | { kind: "admin"; email: string };
type Target = { sessionId: string; agent: string; key: string };

function cookieOf(req: IncomingMessage, name: string) {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

async function identify(req: IncomingMessage, sessionId: string, agent: string): Promise<Viewer | null> {
  await ready();
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) });
  if (!session) return null;
  if (agent !== MAIN_AGENT && !(session.status === "running" && (await isOpenAgent(session, agent)))) {
    const admin = await adminFromRequest(req);
    return admin ? { kind: "admin", email: admin.email } : null;
  }
  if (candidateOwns(session, cookieOf(req, CANDIDATE_COOKIE)) && session.status === "running") return { kind: "candidate" };
  const admin = await adminFromRequest(req);
  if (admin) return { kind: "admin", email: admin.email };
  return null;
}

const masks: RegExp[] = [/sk-ant-[A-Za-z0-9_-]{20,}/g, /sdl_[A-Za-z0-9_-]{20,}/g, /gh[pousr]_[A-Za-z0-9]{36,}/g, /AKIA[0-9A-Z]{16}/g];

function mask(text: string) {
  return masks.reduce((acc, re) => acc.replace(re, "•••"), text);
}

class Recorder {
  private started = Date.now();
  private file: fs.WriteStream;

  constructor(key: string) {
    const target = castPath(key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const fresh = !fs.existsSync(target);
    this.file = fs.createWriteStream(target, { flags: "a" });
    if (fresh) this.file.write(`${JSON.stringify({ version: 2, width: 120, height: 32, timestamp: Math.floor(this.started / 1000) })}\n`);
    else this.started = Date.now() - this.offset(target);
  }

  private offset(target: string) {
    const lines = fs.readFileSync(target, "utf8").trim().split("\n");
    const last = lines.length > 1 ? JSON.parse(lines[lines.length - 1]) : null;
    return last ? Math.round(last[0] * 1000) + 1000 : 0;
  }

  write(kind: "o" | "i" | "r", data: string) {
    const t = (Date.now() - this.started) / 1000;
    this.file.write(`${JSON.stringify([Number(t.toFixed(3)), kind, mask(data)])}\n`);
  }

  close() {
    this.file.end();
  }
}

const globalForTerminals = globalThis as unknown as { seedlingRecorders?: Map<string, Recorder>; seedlingSizes?: Map<string, string> };
const recorders = globalForTerminals.seedlingRecorders ?? new Map<string, Recorder>();
const sizes = globalForTerminals.seedlingSizes ?? new Map<string, string>();
globalForTerminals.seedlingRecorders = recorders;
globalForTerminals.seedlingSizes = sizes;

function recorderFor(sessionId: string) {
  let recorder = recorders.get(sessionId);
  if (!recorder) {
    recorder = new Recorder(sessionId);
    recorders.set(sessionId, recorder);
  }
  return recorder;
}

function closeRecorder(sessionId: string) {
  recorders.get(sessionId)?.close();
  recorders.delete(sessionId);
}

type ShellEntry = { write(data: string): void; resize(c: number, r: number): void; close(): void };

const shells = new Map<string, ShellEntry>();

async function shellFor({ sessionId, agent, key }: Target): Promise<{ entry: ShellEntry; fresh: "revived" | "shell" | null } | null> {
  const existing = shells.get(key);
  if (existing) return { entry: existing, fresh: null };
  const found = await sandbox().find(sessionId);
  const containerId = found ?? (await ensureSandbox(sessionId));
  if (!containerId) return null;
  const again = shells.get(key);
  if (again) return { entry: again, fresh: null };
  const shell = await sandbox().shell(containerId, { cwd: agentCwd(agent), env: agentShellEnv(agent) });
  let focusReporting = false;
  const entry = {
    write: (data: string) => {
      const clean = filterInput(data, focusReporting);
      if (clean) shell.stream.write(clean);
    },
    resize: (c: number, r: number) => void shell.resize(c, r),
    close: () => {
      shell.close();
      closeRecorder(key);
      shells.delete(key);
      shellResets.delete(key);
    },
  };
  shellResets.set(key, entry.close);
  shell.stream.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    focusReporting = trackFocusMode(focusReporting, text);
    lastOutput.set(key, Date.now());
    recorderFor(key).write("o", text);
    const masked = mask(text);
    mirrorFor(key).write(masked);
    bus.emit(`terminal:${key}`, masked);
  });
  shell.stream.on("end", () => {
    const note = "\r\n[session closed]\r\n";
    mirrorFor(key).write(note);
    bus.emit(`terminal:${key}`, note);
    entry.close();
  });
  shell.stream.on("error", () => entry.close());
  shells.set(key, entry);
  const reset = "\u001b[?1004l";
  mirrorFor(key).write(reset);
  bus.emit(`terminal:${key}`, reset);
  const known = sizes.get(key);
  if (known) {
    const [cols, rows] = known.split("x").map(Number);
    entry.resize(cols, rows);
  }
  return { entry, fresh: found ? "shell" : "revived" };
}

export function attachTerminal(server: import("node:http").Server, ignore: (req: import("node:http").IncomingMessage) => boolean = () => false) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", async (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://local");
    if (url.pathname !== "/ws/terminal" || ignore(req)) return;
    if (!upgradeAllowed(req.headers.origin, req.headers.host, env.url)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    const sessionId = url.searchParams.get("session") ?? "";
    const agentParam = url.searchParams.get("agent") ?? MAIN_AGENT;
    const agent = validAgentKey(agentParam) ? agentParam : MAIN_AGENT;
    const viewer = await identify(req, sessionId, agent).catch(() => null);
    if (!viewer) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    const cols = Number(url.searchParams.get("cols"));
    const rows = Number(url.searchParams.get("rows"));
    const initial = cols > 0 && rows > 0 && cols <= 1000 && rows <= 500 ? ([cols, rows] as [number, number]) : null;
    const target = { sessionId, agent, key: terminalKey(sessionId, agent) };
    wss.handleUpgrade(req, socket, head, (ws) => void handle(ws, target, viewer, initial).catch(() => ws.close()));
  });
}

function setSize(key: string, cols: number, rows: number) {
  const size = `${cols}x${rows}`;
  if (sizes.get(key) === size) return;
  sizes.set(key, size);
  recorderFor(key).write("r", size);
  mirrorFor(key).resize(cols, rows);
  bus.emit(`terminal-size:${key}`, size);
}

async function handle(ws: WebSocket, target: Target, viewer: Viewer, initial: [number, number] | null) {
  const { key } = target;
  const send = (data: string) => ws.readyState === WebSocket.OPEN && ws.send(data);
  let closed = false;
  const queued: string[] = [];
  let shell: ShellEntry | null = null;
  let pendingSize: [number, number] | null = null;
  ws.on("close", () => {
    closed = true;
  });
  if (viewer.kind === "candidate") {
    ws.on("message", (raw) => {
      const text = raw.toString();
      if (text.startsWith("\u0000resize:")) {
        const [cols, rows] = text.slice(8).split("x").map(Number);
        if (!(cols > 0 && rows > 0 && cols <= 1000 && rows <= 500)) return;
        setSize(key, cols, rows);
        if (shell) shell.resize(cols, rows);
        else pendingSize = [cols, rows];
        return;
      }
      if (shell) shell.write(text);
      else if (queued.length < 200) queued.push(text);
    });
  }
  if (viewer.kind === "candidate" && initial) {
    setSize(key, initial[0], initial[1]);
    pendingSize = initial;
  }
  const mirror = mirrorFor(key);
  const snapshot = await mirror.snapshot();
  if (closed) return;
  const [cols, rows] = [mirror.cols, mirror.rows];
  if (viewer.kind === "admin") send(`\u0000size:${cols}x${rows}`);
  if (snapshot) send(snapshot);
  const listener = (data: string) => send(data);
  bus.on(`terminal:${key}`, listener);
  ws.on("close", () => bus.off(`terminal:${key}`, listener));
  if (viewer.kind === "admin") {
    const onSize = (size: string) => send(`\u0000size:${size}`);
    bus.on(`terminal-size:${key}`, onSize);
    ws.on("close", () => bus.off(`terminal-size:${key}`, onSize));
    return;
  }
  const opened = await shellFor(target).catch((error) => {
    console.error("[seedling] terminal", key, error);
    return null;
  });
  if (closed) return;
  shell = opened?.entry ?? null;
  if (opened?.fresh) send(`\u0000fresh:${opened.fresh}`);
  if (!shell) {
    send("\r\n\x1b[33m[the sandbox is not running for this session]\x1b[0m\r\n");
    return;
  }
  if (pendingSize) shell.resize(pendingSize[0], pendingSize[1]);
  for (const text of queued.splice(0)) shell.write(text);
}
