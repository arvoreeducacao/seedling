import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isPlayground } from "./playground";

export type PracticeStats = {
  kind: "playground" | "challenge";
  status: (typeof schema.sessions.$inferSelect)["status"];
  startedAt: Date | null;
  endedAt: Date | null;
  minutes: number;
  minutesUsed: number;
  spent: number;
  prompts: number;
};

export function minutesUsed(startedAt: Date | null, endedAt: Date | null, limit: number, now = Date.now()) {
  if (!startedAt) return 0;
  const end = endedAt?.getTime() ?? now;
  return Math.min(limit, Math.max(0, Math.round((end - startedAt.getTime()) / 60_000)));
}

export async function practiceStats(practiceId: string | null | undefined): Promise<PracticeStats | null> {
  if (!practiceId) return null;
  const practice = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, practiceId) });
  if (!practice) return null;
  const calls = await db.query.aiCalls.findMany({ where: eq(schema.aiCalls.sessionId, practiceId), columns: { costUsd: true, prompt: true } });
  return {
    kind: isPlayground(practice) ? "playground" : "challenge",
    status: practice.status,
    startedAt: practice.startedAt,
    endedAt: practice.endedAt,
    minutes: practice.minutes,
    minutesUsed: minutesUsed(practice.startedAt, practice.endedAt, practice.minutes + practice.extraMinutes),
    spent: calls.reduce((sum, c) => sum + c.costUsd, 0),
    prompts: calls.filter((c) => c.prompt && !c.prompt.startsWith("[")).length,
  };
}
