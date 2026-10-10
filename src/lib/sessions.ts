import fs from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { AppError, defaultLocale, type Key, type Locale } from "@/lib/i18n";
import { db, ready, schema } from "@/lib/db";
import { hashToken, newId, newToken, sameHash } from "@/lib/crypto";
import { dataPath, env } from "@/lib/env";
import { extendPasses, issuePass, revokePasses } from "@/lib/gateway";
import { copyForCandidate, runHidden } from "@/lib/challenges/store";
import { sandbox } from "@/lib/sandbox";
import { bus } from "@/lib/bus";
import { agentsHostDir, ensureRepo } from "@/lib/agents";
import { makeTreeWritable } from "@/lib/safe-path";
import { clearStage, installSetup } from "@/lib/setup/install";
import { progressFor, recordPractice } from "@/lib/prep";
import type { Kit } from "@/lib/prep/kit";
import { PLAYGROUND_FILES, isPlayground, practicePlan, practiceRoomFree } from "@/lib/prep/playground";

export type Session = typeof schema.sessions.$inferSelect;
export const CANDIDATE_COOKIE = "seedling_candidate";

export function workspaceDir(sessionId: string, index: number) {
  return dataPath("sessions", sessionId, `desafio-${index + 1}`);
}

export function terminalKey(sessionId: string, agent = "main") {
  return agent === "main" ? sessionId : `${sessionId}~${agent}`;
}

export function castPath(key: string) {
  const [sessionId, agent] = key.split("~");
  return dataPath("sessions", sessionId, agent ? `terminal-${agent}.cast` : "terminal.cast");
}

export function inviteUrl(token: string) {
  return `${env.url}/s/${token}`;
}

export async function createInvite(input: {
  email: string;
  name?: string | null;
  jobId?: string | null;
  challengeIds: string[];
  minutes: number;
  budgetUsd: number;
  model: string;
  mode: "live" | "async";
  inviteDays: number;
  scheduledAt?: Date | null;
  locale?: Locale;
  createdBy: string;
}) {
  await ready();
  const token = newToken("inv");
  const id = newId();
  await db.insert(schema.sessions).values({
    id,
    jobId: input.jobId ?? null,
    candidateEmail: input.email.trim().toLowerCase(),
    candidateName: input.name ?? null,
    mode: input.mode,
    locale: input.locale ?? defaultLocale,
    inviteTokenHash: hashToken(token),
    inviteExpiresAt: inviteExpiry(input.inviteDays, input.scheduledAt ?? null),
    scheduledAt: input.scheduledAt ?? null,
    challengeIds: input.challengeIds,
    minutes: input.minutes,
    budgetUsd: input.budgetUsd,
    model: input.model,
    createdBy: input.createdBy,
  });
  await db.insert(schema.attempts).values(
    input.challengeIds.map((challengeId, index) => ({ id: newId(), sessionId: id, challengeId, index })),
  );
  return { id, token, url: inviteUrl(token) };
}

export function inviteExpiry(inviteDays: number, scheduledAt: Date | null, now = Date.now()) {
  const byDays = now + inviteDays * 86_400_000;
  const afterInterview = scheduledAt ? scheduledAt.getTime() + 86_400_000 : 0;
  return new Date(Math.max(byDays, afterInterview));
}

export async function sessionByInvite(token: string) {
  await ready();
  return db.query.sessions.findFirst({ where: eq(schema.sessions.inviteTokenHash, hashToken(token)) });
}

export function deadline(session: Session) {
  if (!session.startedAt) return null;
  const pausedNow = session.pausedAt ? Date.now() - session.pausedAt.getTime() : 0;
  return new Date(session.startedAt.getTime() + (session.minutes + session.extraMinutes) * 60_000 + session.pausedMs + pausedNow);
}

export function remainingMs(session: Session) {
  const end = deadline(session);
  if (!end) return (session.minutes + session.extraMinutes) * 60_000;
  return Math.max(0, end.getTime() - Date.now());
}

export function candidateOwns(session: Session, cookie: string | undefined) {
  return Boolean(cookie && session.candidateCookieHash && sameHash(session.candidateCookieHash, hashToken(cookie)));
}

async function logEvent(sessionId: string, kind: (typeof schema.events.$inferInsert)["kind"], actor: string, data: Record<string, unknown> = {}) {
  await db.insert(schema.events).values({ id: newId(), sessionId, kind, actor, data });
  bus.emit(`session:${sessionId}`, { kind, actor, data, at: Date.now() });
}

export { logEvent };

async function prepareWorkspace(session: Session, index: number) {
  const dir = workspaceDir(session.id, index);
  await fs.mkdir(dir, { recursive: true });
  const existing = await fs.readdir(dir);
  if (!existing.length) {
    if (isPlayground(session)) await writePlayground(dir);
    else await copyForCandidate(session.challengeIds[index], dir);
    await makeTreeWritable(dir);
  } else {
    await fs.chmod(dir, 0o777);
  }
  return dir;
}

async function writePlayground(dir: string) {
  for (const [rel, content] of Object.entries(PLAYGROUND_FILES)) {
    const file = path.join(dir, rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }
}

export async function startContainer(session: Session, passToken: string) {
  const dir = await prepareWorkspace(session, session.currentIndex);
  const gateway = `${env.sandbox.gatewayUrl}/api/gateway/anthropic`;
  const agents = agentsHostDir(session.id, session.currentIndex);
  await fs.mkdir(agents, { recursive: true });
  await fs.chmod(agents, 0o777);
  const setup = await clearStage(session.id);
  const containerId = await sandbox().start({
    sessionId: session.id,
    workspace: dir,
    agents,
    setup,
    env: {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "safe.directory",
      GIT_CONFIG_VALUE_0: "*",
      ANTHROPIC_BASE_URL: gateway,
      ANTHROPIC_AUTH_TOKEN: passToken,
      ANTHROPIC_MODEL: session.model,
      ANTHROPIC_SMALL_FAST_MODEL: session.model,
      SEEDLING_SESSION: session.id,
      SEEDLING_PREVIEW_BASE: "/",
    },
  });
  await ensureRepo(containerId).catch((error) => console.error("[seedling] git setup", session.id, error));
  await installSetup(session.id, containerId, session.practiceOf ?? session.id).catch(() => console.error("[seedling] candidate setup install failed", session.id));
  return containerId;
}

export async function startSession(session: Session) {
  if (session.status !== "invited") throw new AppError("server.alreadyStarted");
  if (session.inviteExpiresAt.getTime() < Date.now()) throw new AppError("server.inviteExpired");
  if (!session.practiceOf) await endPractice(session.id, "revoke.interviewStarted");
  const running = await sandbox().running();
  if (session.practiceOf ? !practiceRoomFree(running, env.sandbox.maxConcurrent) : running >= env.sandbox.maxConcurrent) throw new AppError("server.roomsBusy");
  const cookie = newToken("cnd");
  const startedAt = new Date();
  const updated = { ...session, status: "running" as const, startedAt, candidateCookieHash: hashToken(cookie) };
  const expiresAt = deadline(updated)!;
  const pass = await issuePass(session.id, expiresAt, session.budgetUsd);
  await db
    .update(schema.sessions)
    .set({ status: "running", startedAt, candidateCookieHash: hashToken(cookie) })
    .where(and(eq(schema.sessions.id, session.id), eq(schema.sessions.status, "invited")));
  await db
    .update(schema.attempts)
    .set({ startedAt })
    .where(and(eq(schema.attempts.sessionId, session.id), eq(schema.attempts.index, 0)));
  await passStore.set(session.id, pass);
  await startContainer(updated, pass);
  await logEvent(session.id, "start", "candidate");
  return cookie;
}

export async function practiceSession(parentId: string) {
  const progress = await progressFor(parentId);
  if (!progress?.practiceSessionId) return null;
  const practice = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, progress.practiceSessionId) });
  return practice ? { practice, token: progress.practiceToken } : null;
}

async function endPractice(parentId: string, reason: Key) {
  const found = await practiceSession(parentId);
  if (found?.practice.status === "running") await finish(found.practice, "submitted", reason);
}

export async function startPractice(parent: Session, kit: Kit) {
  if (parent.practiceOf) throw new AppError("server.alreadyPractice");
  if (parent.status !== "invited") throw new AppError("server.practiceClosed");
  const plan = practicePlan(kit.practice);
  if (!plan) throw new AppError("server.noPracticeRun");
  const existing = await practiceSession(parent.id);
  if (existing) {
    if (existing.practice.status === "running" && existing.token) return { token: existing.token, cookie: null };
    throw new AppError("server.practiceUsed");
  }
  if (plan.kind === "challenge") {
    const challenge = await db.query.challenges.findFirst({ where: and(eq(schema.challenges.id, plan.challengeId), eq(schema.challenges.status, "published")) });
    if (!challenge) throw new AppError("server.practiceChallengeGone");
  }
  const challengeIds = plan.kind === "challenge" ? [plan.challengeId] : [];
  const token = newToken("inv");
  const id = newId();
  await db.insert(schema.sessions).values({
    id,
    jobId: parent.jobId,
    candidateEmail: parent.candidateEmail,
    candidateName: parent.candidateName,
    mode: "async",
    inviteTokenHash: hashToken(token),
    inviteExpiresAt: new Date(Date.now() + 86_400_000),
    challengeIds,
    minutes: plan.minutes,
    budgetUsd: plan.budgetUsd,
    model: parent.model,
    practiceOf: parent.id,
    createdBy: "practice",
  });
  if (plan.kind === "challenge") await db.insert(schema.attempts).values({ id: newId(), sessionId: id, challengeId: plan.challengeId, index: 0 });
  await recordPractice(parent.id, id, token);
  const practice = (await db.query.sessions.findFirst({ where: eq(schema.sessions.id, id) }))!;
  try {
    const cookie = await startSession(practice);
    return { token, cookie };
  } catch (error) {
    await db.update(schema.sessions).set({ status: "cancelled", endedAt: new Date() }).where(eq(schema.sessions.id, id));
    await db.update(schema.prepProgress).set({ practiceSessionId: null, practiceToken: null }).where(eq(schema.prepProgress.sessionId, parent.id));
    throw error;
  }
}

export const passStore = {
  async set(sessionId: string, token: string) {
    const file = dataPath("sessions", sessionId, ".pass");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, token, { mode: 0o600 });
  },
  async get(sessionId: string) {
    return fs.readFile(dataPath("sessions", sessionId, ".pass"), "utf8").catch(() => null);
  },
  async clear(sessionId: string) {
    await fs.rm(dataPath("sessions", sessionId, ".pass"), { force: true });
  },
};

async function stopContainer(sessionId: string) {
  const id = await sandbox().find(sessionId);
  if (id) await sandbox().stop(id);
}

async function grade(session: Session, index: number) {
  const attempt = await db.query.attempts.findFirst({
    where: and(eq(schema.attempts.sessionId, session.id), eq(schema.attempts.index, index)),
  });
  if (!attempt || attempt.submittedAt) return;
  await db.update(schema.attempts).set({ submittedAt: new Date() }).where(eq(schema.attempts.id, attempt.id));
  const result = await runHidden(attempt.challengeId, workspaceDir(session.id, index)).catch((e) => ({
    passed: 0,
    total: 0,
    output: String(e),
    exitCode: 1,
    timedOut: false,
  }));
  if (result) {
    await db
      .update(schema.attempts)
      .set({ hiddenPassed: result.passed, hiddenTotal: result.total, hiddenOutput: result.output.slice(-20_000) })
      .where(eq(schema.attempts.id, attempt.id));
  }
}

export async function submitCurrent(session: Session, actor: string) {
  if (session.status !== "running") throw new AppError("server.sessionNotInProgress");
  const index = session.currentIndex;
  await logEvent(session.id, "submit", actor, { index });
  await stopContainer(session.id);
  const isLast = index >= session.challengeIds.length - 1;
  if (isLast) {
    await finish(session, "submitted", "revoke.lastSubmitted");
    void grade(session, index);
    return { finished: true };
  }
  await db.update(schema.sessions).set({ currentIndex: index + 1 }).where(eq(schema.sessions.id, session.id));
  await db
    .update(schema.attempts)
    .set({ startedAt: new Date() })
    .where(and(eq(schema.attempts.sessionId, session.id), eq(schema.attempts.index, index + 1)));
  const pass = await passStore.get(session.id);
  if (pass) await startContainer({ ...session, currentIndex: index + 1 }, pass);
  void grade(session, index);
  return { finished: false };
}

export async function finish(session: Session, status: "submitted" | "expired" | "cancelled", reason: Key) {
  await db.update(schema.sessions).set({ status, endedAt: new Date() }).where(eq(schema.sessions.id, session.id));
  await revokePasses(session.id, reason);
  await passStore.clear(session.id);
  await stopContainer(session.id);
  await logEvent(session.id, "revoke", "system", { reason });
}

export async function extend(session: Session, minutes: number, actor: string) {
  const extraMinutes = session.extraMinutes + minutes;
  await db.update(schema.sessions).set({ extraMinutes }).where(eq(schema.sessions.id, session.id));
  const end = deadline({ ...session, extraMinutes });
  if (end) await extendPasses(session.id, end);
  await logEvent(session.id, "extend", actor, { minutes });
}

export async function revokeAi(session: Session, actor: string) {
  await revokePasses(session.id, "revoke.byInterviewer");
  await logEvent(session.id, "revoke", actor, { reason: "revoke.byInterviewer" });
}

export async function sweep() {
  await ready();
  const running = await db.query.sessions.findMany({ where: eq(schema.sessions.status, "running") });
  for (const session of running) {
    if (remainingMs(session) <= 0) {
      const index = session.currentIndex;
      await finish(session, "expired", "revoke.timeRanOut");
      void grade(session, index);
    }
  }
}

export async function listSessions() {
  await ready();
  return db.query.sessions.findMany({ where: isNull(schema.sessions.practiceOf), orderBy: desc(schema.sessions.createdAt) });
}

export async function sessionDetail(id: string) {
  await ready();
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, id) });
  if (!session) return null;
  const [attempts, challengeRows, calls, events, evaluations, passes] = await Promise.all([
    db.query.attempts.findMany({ where: eq(schema.attempts.sessionId, id), orderBy: asc(schema.attempts.index) }),
    session.challengeIds.length
      ? db.query.challenges.findMany({ where: inArray(schema.challenges.id, session.challengeIds) })
      : Promise.resolve([]),
    db.query.aiCalls.findMany({ where: eq(schema.aiCalls.sessionId, id), orderBy: asc(schema.aiCalls.createdAt) }),
    db.query.events.findMany({ where: eq(schema.events.sessionId, id), orderBy: asc(schema.events.createdAt) }),
    db.query.evaluations.findMany({ where: eq(schema.evaluations.sessionId, id) }),
    db.query.passes.findMany({ where: eq(schema.passes.sessionId, id) }),
  ]);
  const challenges = session.challengeIds.map((cid) => challengeRows.find((c) => c.id === cid)!).filter(Boolean);
  const spent = calls.reduce((sum, c) => sum + c.costUsd, 0);
  const aiActive = passes.some((p) => !p.revokedAt && p.expiresAt.getTime() > Date.now());
  return { session, attempts, challenges, calls, events, evaluations, spent, aiActive };
}

export async function activePass(sessionId: string) {
  return db.query.passes.findFirst({ where: and(eq(schema.passes.sessionId, sessionId), isNull(schema.passes.revokedAt)) });
}
