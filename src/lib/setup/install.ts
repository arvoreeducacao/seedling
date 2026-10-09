import fs from "node:fs/promises";
import path from "node:path";
import type { SetupInstall, SetupMcpServer } from "@/lib/db/schema";
import { dataPath } from "@/lib/env";
import { SETUP_MOUNT } from "./mount";
import { sandbox } from "@/lib/sandbox";
import { getSetup, recordInstall, type CandidateSetup } from "./store";
import { setupPolicy, type SetupPolicy } from "./policy";
import { RESERVED_MCP_NAMES, cleanRelativePath, validSkillName } from "./validate";

export { SETUP_MOUNT };

export const INSTALL_SCRIPT = [
  "set -e",
  `src=${SETUP_MOUNT}`,
  'mkdir -p "$HOME/.claude/skills"',
  'if [ -d "$src/skills" ]; then cp -R "$src/skills/." "$HOME/.claude/skills/"; fi',
  'if [ -f "$src/CLAUDE.md" ]; then cp "$src/CLAUDE.md" "$HOME/.claude/CLAUDE.md"; fi',
  'if [ -f "$src/claude.json" ]; then cp "$src/claude.json" "$HOME/.claude.json.seedling" && mv "$HOME/.claude.json.seedling" "$HOME/.claude.json"; fi',
].join("\n");

export function setupStageDir(sessionId: string) {
  return dataPath("sessions", sessionId, "setup-stage");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeClaudeConfig(existing: unknown, servers: SetupMcpServer[]) {
  const config: Record<string, unknown> = isObject(existing) ? { ...existing } : {};
  const current = isObject(config.mcpServers) ? config.mcpServers : {};
  const reserved = Object.fromEntries(Object.entries(current).filter(([name]) => RESERVED_MCP_NAMES.has(name.toLowerCase())));
  const incoming = Object.fromEntries(
    servers
      .filter((s) => !RESERVED_MCP_NAMES.has(s.name.toLowerCase()))
      .map((s) => [s.name, { type: s.type, url: s.url, ...(Object.keys(s.headers).length ? { headers: { ...s.headers } } : {}) }]),
  );
  config.mcpServers = { ...current, ...incoming, ...reserved };
  return config;
}

export function installable(setup: CandidateSetup, policy: SetupPolicy) {
  return {
    skills: policy.skills ? setup.skills.filter((s) => validSkillName(s.name)) : [],
    claudeMd: policy.claudeMd ? setup.claudeMd : null,
    mcpServers: policy.mcpServers ? setup.mcpServers : [],
  };
}

async function writeReadable(file: string, content: string) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o755 });
  await fs.writeFile(file, content, { mode: 0o644 });
  await fs.chmod(file, 0o644);
}

async function chmodDirs(root: string) {
  await fs.chmod(root, 0o755);
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory()) await chmodDirs(path.join(root, entry.name));
  }
}

export async function clearStage(sessionId: string) {
  const dir = setupStageDir(sessionId);
  await fs.mkdir(dir, { recursive: true });
  for (const entry of await fs.readdir(dir)) await fs.rm(path.join(dir, entry), { recursive: true, force: true });
  await fs.chmod(dir, 0o755);
  return dir;
}

export async function stageFiles(dir: string, plan: ReturnType<typeof installable>) {
  for (const skill of plan.skills) {
    const base = path.join(dir, "skills", skill.name);
    for (const file of skill.files) {
      const target = path.join(base, cleanRelativePath(file.path));
      if (!target.startsWith(`${base}${path.sep}`)) throw new Error("skill file escapes its folder");
      await writeReadable(target, file.content);
    }
  }
  if (plan.claudeMd) await writeReadable(path.join(dir, "CLAUDE.md"), plan.claudeMd);
  await chmodDirs(dir);
}

async function readClaudeConfig(containerId: string) {
  const result = await sandbox().exec(containerId, 'cat "$HOME/.claude.json" 2>/dev/null || true', 15_000);
  try {
    return JSON.parse(result.output.trim() || "{}");
  } catch {
    return {};
  }
}

export async function installSetup(sessionId: string, containerId: string, ownerId = sessionId): Promise<SetupInstall | null> {
  const setup = await getSetup(ownerId);
  const plan = installable(setup, await setupPolicy());
  if (!plan.skills.length && !plan.claudeMd && !plan.mcpServers.length) return null;
  const record: SetupInstall = {
    at: new Date().toISOString(),
    skills: plan.skills.map((s) => s.name),
    claudeMd: Boolean(plan.claudeMd),
    mcpServers: plan.mcpServers.map((s) => s.name),
  };
  const dir = await clearStage(sessionId);
  try {
    await stageFiles(dir, plan);
    if (plan.mcpServers.length) {
      const merged = mergeClaudeConfig(await readClaudeConfig(containerId), plan.mcpServers);
      await writeReadable(path.join(dir, "claude.json"), JSON.stringify(merged));
    }
    const result = await sandbox().exec(containerId, INSTALL_SCRIPT, 60_000);
    if (result.exitCode !== 0) record.error = "Copying the setup into the sandbox failed.";
  } catch {
    record.error = "Preparing the setup failed.";
  } finally {
    await clearStage(sessionId).catch(() => {});
  }
  if (ownerId === sessionId) await recordInstall(sessionId, record);
  return record;
}
