import path from "node:path";
import { listTree } from "@/lib/candidate";
import { challengeDir, listFiles } from "@/lib/challenges/store";
import { countChanges, diffLines, toHunks, type Hunk } from "@/lib/diff";
import { readInside, statInside } from "@/lib/safe-path";
import { workspaceDir, type Session } from "@/lib/sessions";

const MAX_DIFF_BYTES = 200 * 1024;

export type FileChange = { path: string; status: "added" | "modified" | "deleted"; added: number; removed: number; hunks: Hunk[]; skipped: "binary" | "large" | null };

async function readText(root: string, rel: string) {
  const read = await readInside(root, rel, MAX_DIFF_BYTES).catch(() => null);
  if (!read) return { text: null, skipped: null };
  const buffer = read.buffer;
  if (!buffer) return { text: null, skipped: "large" as const };
  if (buffer.subarray(0, 8000).includes(0)) return { text: null, skipped: "binary" as const };
  return { text: buffer.toString("utf8"), skipped: null };
}

export async function workspaceChanges(session: Session, index = session.currentIndex): Promise<FileChange[]> {
  const challengeId = session.challengeIds[index];
  if (!challengeId) return [];
  const baseRoot = challengeDir(challengeId);
  const root = path.resolve(workspaceDir(session.id, index));
  const baseline = new Set((await listFiles(challengeId)).filter((f) => f.role === "statement" || f.role === "visible" || f.role === "visible-test").map((f) => f.path));
  const current = (await listTree(root, 3000)).filter((f) => !f.dir).map((f) => f.path);
  const paths = [...new Set([...baseline, ...current])].sort();
  const changes: FileChange[] = [];
  for (const rel of paths) {
    const inBase = baseline.has(rel);
    const before = inBase ? await readText(baseRoot, rel) : { text: "", skipped: null };
    const after = current.includes(rel) ? await readText(root, rel) : { text: null, skipped: null };
    const status = !inBase ? "added" : !current.includes(rel) ? "deleted" : "modified";
    const skipped = before.skipped ?? after.skipped;
    if (skipped) {
      if (status !== "modified") changes.push({ path: rel, status, added: 0, removed: 0, hunks: [], skipped });
      else {
        const [a, b] = await Promise.all([statInside(baseRoot, rel).catch(() => null), statInside(root, rel).catch(() => null)]);
        if (a?.stat.size !== b?.stat.size) changes.push({ path: rel, status, added: 0, removed: 0, hunks: [], skipped });
      }
      continue;
    }
    const oldText = before.text ?? "";
    const newText = after.text ?? "";
    if (status === "modified" && oldText === newText) continue;
    const lines = diffLines(oldText, newText);
    changes.push({ path: rel, status, ...countChanges(lines), hunks: toHunks(lines), skipped: null });
  }
  return changes;
}
