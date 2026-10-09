import { and, desc, eq, inArray } from "drizzle-orm";
import { candidateSession, unauthorized } from "@/lib/candidate";
import { db, schema } from "@/lib/db";
import { remainingMs } from "@/lib/sessions";
import { renderMarkdown } from "@/lib/markdown";
import { currentWatchers } from "@/lib/watchers";
import { displayName } from "@/lib/format";
import { env } from "@/lib/env";
import { activeChallenge } from "@/lib/active-challenge";
import { isPlayground } from "@/lib/prep/playground";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session) return unauthorized();
  const playground = isPlayground(session);
  const challenges = playground ? [] : await db.query.challenges.findMany({ where: inArray(schema.challenges.id, session.challengeIds) });
  const current = await activeChallenge(session);
  const ordered = playground && current ? [{ ...current, minutes: session.minutes }] : session.challengeIds.map((id) => challenges.find((c) => c.id === id)!).filter(Boolean);
  const passes = await db.query.passes.findMany({ where: eq(schema.passes.sessionId, session.id) });
  const pass = passes.find((p) => !p.revokedAt) ?? passes[0];
  const messages = await db.query.events.findMany({
    where: and(eq(schema.events.sessionId, session.id), eq(schema.events.kind, "message")),
    orderBy: desc(schema.events.createdAt),
    limit: 5,
  });
  return Response.json({
    status: session.status,
    practice: session.practiceOf ? (playground ? "playground" : "challenge") : null,
    remainingMs: remainingMs(session),
    currentIndex: session.currentIndex,
    total: ordered.length,
    challenges: ordered.map((c) => ({ title: c.title, kind: c.kind, minutes: c.minutes })),
    challenge: current && {
      title: current.title,
      kind: current.kind,
      statementHtml: renderMarkdown(current.statement),
      flow: current.flow,
      states: current.states,
      hasPreview: Boolean(current.previewPort),
      visibleTestCommand: current.visibleTestCommand,
    },
    ai: {
      active: Boolean(pass && !pass.revokedAt && pass.expiresAt.getTime() > Date.now() && pass.spentUsd < pass.budgetUsd),
      spent: pass?.spentUsd ?? 0,
      budget: pass?.budgetUsd ?? session.budgetUsd,
      expiresAt: pass?.expiresAt ?? null,
      reason: pass?.revokedReason ?? null,
      model: session.model,
    },
    watchers: currentWatchers(session.id).map((email) => displayName(email)),
    messages: messages.map((m) => ({ id: m.id, text: String(m.data.text ?? ""), from: displayName(m.actor), at: m.createdAt })),
    org: env.orgName,
  });
}
