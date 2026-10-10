import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { issuePass } from "@/lib/gateway";
import { sandbox } from "@/lib/sandbox";
import { deadline, logEvent, passStore, remainingMs, startContainer, type Session } from "@/lib/sessions";

const globalForRevive = globalThis as unknown as { seedlingRevivals?: Map<string, Promise<string | null>> };
const inflight = globalForRevive.seedlingRevivals ?? new Map<string, Promise<string | null>>();
globalForRevive.seedlingRevivals = inflight;

async function passForRestart(session: Session) {
  const passes = await db.query.passes.findMany({ where: eq(schema.passes.sessionId, session.id) });
  const live = passes.filter((p) => !p.revokedAt);
  const stored = await passStore.get(session.id);
  if (stored && live.length) return stored;
  if (passes.length && !live.length) return "";
  const end = deadline(session);
  if (!end) return "";
  const spent = passes.reduce((sum, p) => sum + p.spentUsd, 0);
  const budget = Math.max(0, session.budgetUsd - spent);
  if (budget <= 0) return "";
  await db
    .update(schema.passes)
    .set({ revokedAt: new Date(), revokedReason: "workspace.reason.restarted" })
    .where(and(eq(schema.passes.sessionId, session.id), isNull(schema.passes.revokedAt)));
  const token = await issuePass(session.id, end, budget);
  await passStore.set(session.id, token);
  return token;
}

async function revive(sessionId: string) {
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) });
  if (!session || session.status !== "running" || remainingMs(session) <= 0) return null;
  const existing = await sandbox().find(sessionId);
  if (existing) return existing;
  const token = await passForRestart(session);
  const containerId = await startContainer(session, token);
  await logEvent(session.id, "start", "system", { restarted: true });
  return containerId;
}

export function ensureSandbox(sessionId: string) {
  const running = inflight.get(sessionId);
  if (running) return running;
  const attempt = revive(sessionId).finally(() => inflight.delete(sessionId));
  inflight.set(sessionId, attempt);
  return attempt;
}
