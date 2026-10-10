import { and, asc, eq, isNull } from "drizzle-orm";
import { db, ready, schema } from "@/lib/db";
import { AppError } from "@/lib/i18n";
import { newId } from "@/lib/crypto";
import { dataPath, env } from "@/lib/env";
import { sandbox } from "@/lib/sandbox";
import { logEvent, type Session } from "@/lib/sessions";
import { parseUnifiedDiff } from "@/lib/git-diff";
import type { FileChange } from "@/lib/changes";
import { AGENT_HEADER, MAIN_AGENT, validAgentKey } from "@/lib/agent-keys";

export { AGENT_HEADER, MAIN_AGENT, validAgentKey };

export type AgentRow = typeof schema.agents.$inferSelect;
export type AgentInfo = { key: string; name: string; createdAt: string | null; closedAt: string | null; mergedAt: string | null };

export function agentsHostDir(sessionId: string, index: number) {
  return dataPath("sessions", sessionId, `agents-${index + 1}`);
}

export function agentCwd(key: string) {
  return key === MAIN_AGENT ? "/workspace" : `/agents/${key}`;
}

export function agentShellEnv(key: string) {
  return { SEEDLING_AGENT: key, ANTHROPIC_CUSTOM_HEADERS: `${AGENT_HEADER}: ${key}` };
}

export function cleanAgentName(name: unknown, fallback: string) {
  const text = typeof name === "string" ? name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40) : "";
  return text || fallback;
}

export const REPO_SETUP = [
  "cd /workspace",
  "if [ ! -d .git ]; then",
  "git init -q -b main",
  "git config user.name Seedling",
  "git config user.email seedling@localhost",
  "printf 'node_modules/\\n.venv/\\n__pycache__/\\n.pytest_cache/\\n.next/\\ndist/\\n' >> .git/info/exclude",
  "git add -A",
  "git commit -q --allow-empty -m 'Challenge files'",
  "fi",
].join("\n");

function sh(...lines: string[]) {
  return lines.join(" && ");
}

async function container(session: Session) {
  const id = await sandbox().find(session.id);
  if (!id) throw new AppError("workspace.sandboxNotRunning");
  return id;
}

async function run(containerId: string, command: string, timeoutMs = 60_000) {
  const result = await sandbox().exec(containerId, command, timeoutMs);
  if (result.exitCode !== 0) {
    const tail = result.output.trim().split("\n").slice(-3).join(" ");
    throw tail ? new Error(tail) : new AppError("workspace.gitFailed");
  }
  return result.output;
}

export async function ensureRepo(containerId: string) {
  await run(containerId, REPO_SETUP, 120_000);
}

function toInfo(row: AgentRow): AgentInfo {
  return { key: row.key, name: row.name, createdAt: row.createdAt.toISOString(), closedAt: row.closedAt?.toISOString() ?? null, mergedAt: row.mergedAt?.toISOString() ?? null };
}

export async function agentRows(sessionId: string, index?: number) {
  await ready();
  const rows = await db.query.agents.findMany({ where: eq(schema.agents.sessionId, sessionId), orderBy: asc(schema.agents.createdAt) });
  return index === undefined ? rows : rows.filter((r) => r.challengeIndex === index);
}

export async function listAgents(session: Session, index = session.currentIndex): Promise<AgentInfo[]> {
  const rows = await agentRows(session.id, index);
  return [{ key: MAIN_AGENT, name: "Main", createdAt: session.startedAt?.toISOString() ?? null, closedAt: null, mergedAt: null }, ...rows.map(toInfo)];
}

export async function openAgentKeys(session: Session) {
  const rows = await agentRows(session.id, session.currentIndex);
  return [MAIN_AGENT, ...rows.filter((r) => !r.closedAt).map((r) => r.key)];
}

export async function isOpenAgent(session: Session, key: string) {
  return (await openAgentKeys(session)).includes(key);
}

export async function createAgent(session: Session, name?: unknown) {
  const rows = await agentRows(session.id, session.currentIndex);
  const open = rows.filter((r) => !r.closedAt).length + 1;
  if (open >= env.sandbox.maxAgents) throw new AppError("workspace.agentLimit", { max: env.sandbox.maxAgents });
  const number = (await agentRows(session.id)).length + 2;
  const key = `agent-${number}`;
  const containerId = await container(session);
  await ensureRepo(containerId);
  await run(
    containerId,
    sh(
      "cd /workspace",
      "git add -A",
      `(git diff --cached --quiet || git commit -q -m 'Workspace before ${key}')`,
      `git worktree add -q -b agent/${key} /agents/${key} HEAD`,
    ),
  );
  const row = { id: newId(), sessionId: session.id, challengeIndex: session.currentIndex, key, name: cleanAgentName(name, `Agent ${number}`) };
  await db.insert(schema.agents).values(row);
  await logEvent(session.id, "agent-open", "candidate", { agent: key, name: row.name });
  return { key, name: row.name };
}

async function findRow(session: Session, key: string) {
  const row = (await agentRows(session.id, session.currentIndex)).find((r) => r.key === key);
  if (!row) throw new AppError("workspace.unknownAgent");
  return row;
}

export async function renameAgent(session: Session, key: string, name: unknown) {
  const row = await findRow(session, key);
  const next = cleanAgentName(name, row.name);
  await db.update(schema.agents).set({ name: next }).where(eq(schema.agents.id, row.id));
  await logEvent(session.id, "agent-rename", "candidate", { agent: key, name: next });
  return { key, name: next };
}

export async function agentChanges(session: Session, key: string): Promise<FileChange[]> {
  if (key === MAIN_AGENT || !validAgentKey(key)) return [];
  const row = await findRow(session, key);
  if (row.closedAt) return [];
  const containerId = await container(session);
  const output = await run(containerId, sh(`cd /agents/${key}`, "git add -A -N . >/dev/null 2>&1 || true", "base=$(git merge-base HEAD main)", "git -c core.quotepath=off diff --no-color --no-ext-diff -M \"$base\""), 30_000);
  return parseUnifiedDiff(output);
}

function summary(changes: FileChange[]) {
  return { files: changes.map((c) => c.path).slice(0, 50), added: changes.reduce((n, c) => n + c.added, 0), removed: changes.reduce((n, c) => n + c.removed, 0) };
}

export async function mergeAgent(session: Session, key: string): Promise<{ ok: true; files: number } | { ok: false; conflicts: string[]; message: string }> {
  const row = await findRow(session, key);
  if (row.closedAt) throw new AppError("workspace.agentClosed");
  const changes = await agentChanges(session, key);
  const containerId = await container(session);
  await run(containerId, sh(`cd /agents/${key}`, "git add -A", `(git diff --cached --quiet || git commit -q -m 'Work from ${key}')`));
  await run(containerId, sh("cd /workspace", "git add -A", `(git diff --cached --quiet || git commit -q -m 'Workspace before merging ${key}')`));
  const merge = await sandbox().exec(containerId, `cd /workspace && git merge --no-ff --no-edit -m 'Merge ${key}' agent/${key}`, 60_000);
  if (merge.exitCode !== 0) {
    const conflicted = await sandbox().exec(containerId, "cd /workspace && git diff --name-only --diff-filter=U", 15_000);
    await sandbox().exec(containerId, "cd /workspace && git merge --abort", 15_000);
    const conflicts = conflicted.output.split("\n").map((l) => l.trim()).filter(Boolean);
    return { ok: false, conflicts, message: conflicts.length ? "" : merge.output.trim().split("\n").slice(-2).join(" ") };
  }
  await db.update(schema.agents).set({ mergedAt: new Date() }).where(eq(schema.agents.id, row.id));
  await logEvent(session.id, "agent-merge", "candidate", { agent: key, name: row.name, ...summary(changes) });
  return { ok: true, files: changes.length };
}

export async function closeAgent(session: Session, key: string) {
  const row = await findRow(session, key);
  if (row.closedAt) return;
  const changes = await agentChanges(session, key).catch(() => []);
  const containerId = await sandbox().find(session.id);
  if (containerId) {
    await sandbox().exec(containerId, sh(`cd /agents/${key}`, "git add -A", `(git diff --cached --quiet || git commit -q -m 'Work from ${key}')`), 30_000);
    await sandbox().exec(containerId, `cd /workspace && git worktree remove --force /agents/${key}`, 30_000);
  }
  await db.update(schema.agents).set({ closedAt: new Date() }).where(and(eq(schema.agents.id, row.id), isNull(schema.agents.closedAt)));
  await logEvent(session.id, "agent-close", "candidate", { agent: key, name: row.name, merged: Boolean(row.mergedAt), ...summary(changes) });
}
