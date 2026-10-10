import { cookies } from "next/headers";
import { denied, prepClosedReason, prepSession } from "@/lib/prep/request";
import { loadKit, progressFor } from "@/lib/prep";
import { practiceStats } from "@/lib/prep/stats";
import { CANDIDATE_COOKIE, practiceSession, remainingMs, startPractice } from "@/lib/sessions";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { i18nFromRequest } from "@/lib/i18n/server";
import { messageOf } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await prepSession(token);
  if (!session) return denied();
  const found = await practiceSession(session.id);
  if (!found) return Response.json({ status: "none" });
  const [passes, stats] = await Promise.all([
    db.query.passes.findMany({ where: eq(schema.passes.sessionId, found.practice.id) }),
    practiceStats((await progressFor(session.id))?.practiceSessionId),
  ]);
  const spent = passes.reduce((sum, p) => sum + p.spentUsd, 0);
  return Response.json({
    status: found.practice.status,
    remainingMs: found.practice.status === "running" ? remainingMs(found.practice) : 0,
    spent,
    budget: found.practice.budgetUsd,
    minutesUsed: stats?.minutesUsed ?? 0,
    prompts: stats?.prompts ?? 0,
    kind: stats?.kind ?? "challenge",
    url: found.practice.status === "running" && found.token ? `/s/${found.token}/w` : null,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await prepSession(token);
  if (!session) return denied();
  const shut = await prepClosedReason(session);
  if (shut) return shut;
  try {
    const { token: practiceToken, cookie } = await startPractice(session, await loadKit());
    if (cookie) {
      const jar = await cookies();
      jar.set(CANDIDATE_COOKIE, cookie, { httpOnly: true, sameSite: "lax", secure: env.secureCookies, path: "/", maxAge: 12 * 3600 });
    }
    return Response.json({ url: `/s/${practiceToken}/w` });
  } catch (error) {
    return Response.json({ error: messageOf(error, i18nFromRequest(req).t, "server.practiceStartFailed") }, { status: 409 });
  }
}
