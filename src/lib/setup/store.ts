import { eq } from "drizzle-orm";
import { db, ready, schema } from "@/lib/db";
import type { SetupInstall, SetupMcpServer, SetupSkill } from "@/lib/db/schema";
import type { Key } from "@/lib/i18n";
import { setupPolicy, type SetupPolicy } from "./policy";
import { SETUP_LIMITS, SetupError, checkTotals, maskUrl, setupTotals } from "./validate";

export type CandidateSetup = { skills: SetupSkill[]; claudeMd: string | null; mcpServers: SetupMcpServer[]; lastInstall: SetupInstall | null };

export type SetupView = {
  skills: { name: string; files: { path: string; size: number }[]; description: string | null }[];
  claudeMd: { size: number; content: string } | null;
  mcpServers: { name: string; type: "http" | "sse"; url: string; headers: string[] }[];
  totals: { files: number; bytes: number };
  limits: typeof SETUP_LIMITS;
  policy: SetupPolicy;
  lastInstall: SetupInstall | null;
};

const EMPTY: CandidateSetup = { skills: [], claudeMd: null, mcpServers: [], lastInstall: null };

export async function getSetup(sessionId: string): Promise<CandidateSetup> {
  await ready();
  const row = await db.query.candidateSetups.findFirst({ where: eq(schema.candidateSetups.sessionId, sessionId) });
  if (!row) return { ...EMPTY };
  return { skills: row.skills, claudeMd: row.claudeMd, mcpServers: row.mcpServers, lastInstall: row.lastInstall ?? null };
}

async function save(sessionId: string, next: Omit<CandidateSetup, "lastInstall">) {
  checkTotals(next);
  const values = { skills: next.skills, claudeMd: next.claudeMd, mcpServers: next.mcpServers, updatedAt: new Date() };
  await db
    .insert(schema.candidateSetups)
    .values({ sessionId, ...values })
    .onConflictDoUpdate({ target: schema.candidateSetups.sessionId, set: values });
}

const offKeys: Record<keyof SetupPolicy, Key> = { skills: "setup.off.skills", claudeMd: "setup.off.claudeMd", mcpServers: "setup.off.mcpServers" };

function assertAllowed(policy: SetupPolicy, key: keyof SetupPolicy) {
  if (!policy[key]) throw new SetupError(offKeys[key]);
}

export async function addSkills(sessionId: string, skills: SetupSkill[]) {
  assertAllowed(await setupPolicy(), "skills");
  const current = await getSetup(sessionId);
  const names = new Set(skills.map((s) => s.name));
  await save(sessionId, { ...current, skills: [...current.skills.filter((s) => !names.has(s.name)), ...skills] });
}

export async function removeSkill(sessionId: string, name: string) {
  const current = await getSetup(sessionId);
  await save(sessionId, { ...current, skills: current.skills.filter((s) => s.name !== name) });
}

export async function setClaudeMd(sessionId: string, content: string | null) {
  if (content !== null) assertAllowed(await setupPolicy(), "claudeMd");
  const current = await getSetup(sessionId);
  await save(sessionId, { ...current, claudeMd: content });
}

export async function addMcpServers(sessionId: string, servers: SetupMcpServer[]) {
  assertAllowed(await setupPolicy(), "mcpServers");
  const current = await getSetup(sessionId);
  const names = new Set(servers.map((s) => s.name));
  await save(sessionId, { ...current, mcpServers: [...current.mcpServers.filter((s) => !names.has(s.name)), ...servers] });
}

export async function removeMcpServer(sessionId: string, name: string) {
  const current = await getSetup(sessionId);
  await save(sessionId, { ...current, mcpServers: current.mcpServers.filter((s) => s.name !== name) });
}

export async function clearSetup(sessionId: string) {
  await save(sessionId, { skills: [], claudeMd: null, mcpServers: [] });
}

export async function recordInstall(sessionId: string, install: SetupInstall) {
  await db.update(schema.candidateSetups).set({ lastInstall: install }).where(eq(schema.candidateSetups.sessionId, sessionId));
}

function description(skillMd: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd);
  const line = match && /^description:\s*["']?(.+?)["']?\s*$/m.exec(match[1]);
  return line ? line[1].slice(0, 280) : null;
}

export function viewOf(setup: CandidateSetup, policy: SetupPolicy): SetupView {
  return {
    skills: setup.skills.map((s) => ({
      name: s.name,
      files: s.files.map((f) => ({ path: f.path, size: Buffer.byteLength(f.content, "utf8") })),
      description: description(s.files.find((f) => f.path === "SKILL.md")?.content ?? ""),
    })),
    claudeMd: setup.claudeMd ? { size: Buffer.byteLength(setup.claudeMd, "utf8"), content: setup.claudeMd } : null,
    mcpServers: setup.mcpServers.map((s) => ({ name: s.name, type: s.type, url: maskUrl(s.url), headers: Object.keys(s.headers) })),
    totals: setupTotals(setup),
    limits: SETUP_LIMITS,
    policy,
    lastInstall: setup.lastInstall,
  };
}

export async function setupView(sessionId: string) {
  return viewOf(await getSetup(sessionId), await setupPolicy());
}
