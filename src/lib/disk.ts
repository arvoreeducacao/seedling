import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { dataPath, env } from "@/lib/env";
import { sandbox } from "@/lib/sandbox";
import { dirSize } from "@/lib/candidate";
import { logEvent } from "@/lib/sessions";

export type SessionUsage = { sessionId: string; bytes: number };

export function pickToStop(usage: SessionUsage[], freeBytes: number, reserveBytes: number) {
  if (freeBytes >= reserveBytes || !usage.length) return null;
  return usage.reduce((max, u) => (u.bytes > max.bytes ? u : max));
}

// /workspace and /agents are writable mounts of the data volume that also holds the database,
// so one sandbox filling them stops every session. Measuring is only worth it when space runs low.
export async function guardDisk() {
  const stat = await fs.statfs(env.dataDir).catch(() => null);
  if (!stat) return null;
  const free = stat.bavail * stat.bsize;
  const reserve = env.sandbox.diskReserveMb * 1024 * 1024;
  if (free >= reserve) return null;
  const running = await db.query.sessions.findMany({ where: eq(schema.sessions.status, "running") });
  const usage: SessionUsage[] = [];
  for (const session of running) {
    if (!(await sandbox().find(session.id))) continue;
    usage.push({ sessionId: session.id, bytes: await dirSize(dataPath("sessions", session.id)) });
  }
  const victim = pickToStop(usage, free, reserve);
  if (!victim) return null;
  const id = await sandbox().find(victim.sessionId);
  if (id) await sandbox().stop(id);
  await logEvent(victim.sessionId, "disk-full", "system", { mb: Math.round(victim.bytes / 1024 / 1024) });
  console.warn("[seedling] disk almost full, stopped the largest sandbox", victim.sessionId);
  return victim;
}
