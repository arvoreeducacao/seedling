import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { PLAYGROUND_CHALLENGE, isPlayground } from "@/lib/prep/playground";
import type { Session } from "@/lib/sessions";

export type ActiveChallenge = Pick<typeof schema.challenges.$inferSelect, "title" | "kind" | "runtime" | "statement" | "visibleTestCommand" | "previewPort" | "flow" | "states">;

export async function activeChallenge(session: Session): Promise<ActiveChallenge | null> {
  if (isPlayground(session)) return PLAYGROUND_CHALLENGE;
  const id = session.challengeIds[session.currentIndex];
  if (!id) return null;
  return (await db.query.challenges.findFirst({ where: eq(schema.challenges.id, id) })) ?? null;
}
