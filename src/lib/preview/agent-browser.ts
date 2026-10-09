import http from "node:http";
import type net from "node:net";
import WebSocket from "ws";
import { sandbox } from "@/lib/sandbox";

export const AGENT_CDP_PORT = 9222;
export const AGENT_PORTS = new Set([AGENT_CDP_PORT, 9223]);
const MAX_SHOT = 8 * 1024 * 1024;

export type CdpTarget = { type?: string; url?: string; title?: string; webSocketDebuggerUrl?: string };
export type AgentPage = { url: string; title: string; socketPath: string };

export function pickPage(targets: unknown): AgentPage | null {
  if (!Array.isArray(targets)) return null;
  for (const target of targets as CdpTarget[]) {
    if (target?.type !== "page" || typeof target.url !== "string" || typeof target.webSocketDebuggerUrl !== "string") continue;
    if (!target.url || target.url === "about:blank" || /^(devtools|chrome|chrome-error):/i.test(target.url)) continue;
    let socketPath: string;
    try {
      socketPath = new URL(target.webSocketDebuggerUrl).pathname;
    } catch {
      continue;
    }
    if (!/^\/devtools\/page\/[\w-]+$/.test(socketPath)) continue;
    return { url: target.url.slice(0, 2000), title: String(target.title ?? "").slice(0, 300), socketPath };
  }
  return null;
}

function viaSandbox(containerId: string) {
  return ((_options: unknown, done: (error: Error | null, socket?: net.Socket) => void) => {
    sandbox()
      .connect(containerId, AGENT_CDP_PORT)
      .then((socket) => done(null, socket as unknown as net.Socket), (error: Error) => done(error));
    return undefined;
  }) as unknown as http.RequestOptions["createConnection"];
}

function getJson(containerId: string, path: string) {
  return new Promise<unknown>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: AGENT_CDP_PORT, path, createConnection: viaSandbox(containerId) }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        body += chunk;
        if (body.length > 1_000_000) req.destroy(new Error("too large"));
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.setTimeout(3000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function agentPage(containerId: string) {
  return pickPage(await getJson(containerId, "/json/list").catch(() => null));
}

export async function agentScreenshot(containerId: string): Promise<Buffer | null> {
  const page = await agentPage(containerId);
  if (!page) return null;
  return new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${AGENT_CDP_PORT}${page.socketPath}`, { createConnection: viaSandbox(containerId) as never, maxPayload: MAX_SHOT * 2, handshakeTimeout: 3000 });
    const finish = (value: Buffer | null) => {
      clearTimeout(timer);
      socket.terminate();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 6000);
    socket.on("open", () => socket.send(JSON.stringify({ id: 1, method: "Page.captureScreenshot", params: { format: "jpeg", quality: 70 } })));
    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.id !== 1) return;
        const data = typeof message.result?.data === "string" ? Buffer.from(message.result.data, "base64") : null;
        finish(data && data.length <= MAX_SHOT && data[0] === 0xff && data[1] === 0xd8 ? data : null);
      } catch {
        finish(null);
      }
    });
    socket.on("error", () => finish(null));
  });
}
