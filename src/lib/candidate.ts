import fs from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { CANDIDATE_COOKIE, candidateOwns, sessionByInvite, workspaceDir, type Session } from "@/lib/sessions";
import { lexicalTarget, readInside } from "@/lib/safe-path";
import { AppError, hasKey, type Key, type T } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export async function candidateSession(token: string): Promise<Session | null> {
  const session = await sessionByInvite(token);
  if (!session) return null;
  const jar = await cookies();
  return candidateOwns(session, jar.get(CANDIDATE_COOKIE)?.value) ? session : null;
}

export async function unauthorized() {
  const { t } = await getI18n();
  return Response.json({ error: t("server.sessionClosed") }, { status: 401 });
}

export function errorText(error: unknown, t: T, fallback: Key) {
  if (error instanceof AppError) return t(error.key, error.params);
  if (error instanceof Error && hasKey(error.message)) return t(error.message);
  return t(fallback);
}

export function workspaceRoot(session: Session) {
  return path.resolve(workspaceDir(session.id, session.currentIndex));
}

export function resolveInWorkspace(session: Session, relative: string) {
  const { base, target } = lexicalTarget(workspaceRoot(session), relative);
  return { root: base, target };
}

const skip = new Set(["node_modules", ".git", "__pycache__", ".next", ".venv", "dist", ".cache"]);

export type TreeEntry = { path: string; dir: boolean; size: number; mtime: number };

export async function listTree(root: string, limit = 2000) {
  const out: TreeEntry[] = [];
  async function walk(dir: string, prefix: string) {
    if (out.length >= limit) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (out.length >= limit) return;
      if (skip.has(entry.name) || entry.name === ".DS_Store") continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push({ path: rel, dir: true, size: 0, mtime: 0 });
        await walk(abs, rel);
      } else if (entry.isFile()) {
        const stat = await fs.lstat(abs).catch(() => null);
        out.push({ path: rel, dir: false, size: stat?.size ?? 0, mtime: Math.round(stat?.mtimeMs ?? 0) });
      }
    }
  }
  await walk(root, "");
  return out;
}

export async function dirSize(root: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const abs = path.join(root, entry.name);
    if (entry.isDirectory()) total += await dirSize(abs);
    else if (entry.isFile()) total += (await fs.lstat(abs).catch(() => ({ size: 0 }))).size;
  }
  return total;
}

export const MAX_TEXT_FILE = 1024 * 1024;

export async function readWorkspaceFile(root: string, rel: string) {
  const { stat, buffer } = await readInside(root, rel, MAX_TEXT_FILE);
  const meta = { path: rel, size: stat.size, mtime: Math.round(stat.mtimeMs) };
  if (!buffer) return { ...meta, content: null, tooLarge: true };
  if (buffer.subarray(0, 8000).includes(0)) return { ...meta, content: null, binary: true };
  return { ...meta, content: buffer.toString("utf8") };
}
