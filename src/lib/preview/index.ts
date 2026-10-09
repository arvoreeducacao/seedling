import { env } from "@/lib/env";
import { sandbox } from "@/lib/sandbox";
import { activeChallenge } from "@/lib/active-challenge";
import type { Session } from "@/lib/sessions";
import { previewSecret, previewSigner } from "./ticket";
import { AGENT_CDP_PORT, AGENT_PORTS, agentPage, agentScreenshot } from "./agent-browser";
import { TICKET_TTL_MS } from "./pass";

export { PASS_TTL_MS, PREVIEW_COOKIE, TICKET_TTL_MS, passLifetime, previewPortAllowed } from "./pass";

export function signer() {
  return previewSigner(previewSecret(env.authSecret));
}

export async function previewInfo(session: Session) {
  if (!env.previewOrigin) {
    return { enabled: false as const, reason: "Set SEEDLING_PREVIEW_ORIGIN to open pages from the sandbox." };
  }
  const challenge = await activeChallenge(session);
  const containerId = await sandbox().find(session.id).catch(() => null);
  const listening = containerId ? await sandbox().listening(containerId).catch(() => []) : [];
  const ports = listening.filter((port) => !AGENT_PORTS.has(port));
  const agent = containerId && listening.includes(AGENT_CDP_PORT) ? await agentState(session.id, containerId) : null;
  const ticket = signer().sign({ kind: "ticket", session: session.id, expires: Date.now() + TICKET_TTL_MS });
  return {
    enabled: true as const,
    origin: env.previewOrigin,
    ticket,
    ports,
    suggested: challenge?.previewPort ?? null,
    running: Boolean(containerId),
    agent,
  };
}

const globalForAgent = globalThis as unknown as {
  seedlingAgentPages?: Map<string, { url: string; changedAt: number }>;
  seedlingAgentShots?: Map<string, { at: number; shot: Promise<Buffer | null> }>;
};
const agentPages = (globalForAgent.seedlingAgentPages ??= new Map());
const agentShots = (globalForAgent.seedlingAgentShots ??= new Map());

async function agentState(sessionId: string, containerId: string) {
  const page = await agentPage(containerId).catch(() => null);
  if (!page) return null;
  const known = agentPages.get(sessionId);
  const changedAt = known && known.url === page.url ? known.changedAt : Date.now();
  agentPages.set(sessionId, { url: page.url, changedAt });
  return { url: page.url, title: page.title, changedAt };
}

export async function agentShot(session: Session) {
  const hit = agentShots.get(session.id);
  if (hit && Date.now() - hit.at < 1200) return hit.shot;
  const shot = sandbox()
    .find(session.id)
    .then((containerId) => (containerId ? agentScreenshot(containerId) : null))
    .catch(() => null);
  agentShots.set(session.id, { at: Date.now(), shot });
  if (agentShots.size > 200) agentShots.delete(agentShots.keys().next().value!);
  return shot;
}

export function shotResponse(shot: Buffer | null) {
  if (!shot) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  return new Response(new Uint8Array(shot), {
    headers: { "content-type": "image/jpeg", "cache-control": "no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" },
  });
}
