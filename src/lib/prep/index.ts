import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, ready, schema } from "@/lib/db";
import { dataPath, env } from "@/lib/env";
import { sameHash } from "@/lib/crypto";
import { defaultKit, parseKit, prepOpensAt, type Kit } from "./kit";
import { applyMark, type StepMark } from "./steps";

export const PREP_COOKIE = "seedling_prep";
const KIT_ID = "default";

export type Progress = typeof schema.prepProgress.$inferSelect;
type SessionRow = typeof schema.sessions.$inferSelect;

export async function loadKit(): Promise<Kit> {
  await ready();
  const row = await db.query.prepKits.findFirst({ where: eq(schema.prepKits.id, KIT_ID) });
  if (!row) return defaultKit;
  const parsed = parseKit(row.kit);
  return parsed.ok ? parsed.kit : defaultKit;
}

export async function kitUpdatedAt() {
  const row = await db.query.prepKits.findFirst({ where: eq(schema.prepKits.id, KIT_ID), columns: { updatedAt: true, updatedBy: true } });
  return row ?? null;
}

export async function saveKit(kit: Kit, by: string) {
  await ready();
  const updatedAt = new Date();
  await db
    .insert(schema.prepKits)
    .values({ id: KIT_ID, kit, updatedBy: by, updatedAt })
    .onConflictDoUpdate({ target: schema.prepKits.id, set: { kit, updatedBy: by, updatedAt } });
}

function secret() {
  if (env.authSecret) return env.authSecret;
  const file = dataPath(".prep-secret");
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const value = randomBytes(32).toString("base64url");
    fs.writeFileSync(file, value, { mode: 0o600 });
    return value;
  }
}

function signature(sessionId: string) {
  return createHmac("sha256", secret()).update(`prep:${sessionId}`).digest("base64url");
}

export function prepCookieValue(sessionId: string) {
  return `${sessionId}.${signature(sessionId)}`;
}

export function prepCookieValid(sessionId: string, cookie: string | undefined) {
  if (!cookie) return false;
  const dot = cookie.lastIndexOf(".");
  if (dot < 0 || cookie.slice(0, dot) !== sessionId) return false;
  return sameHash(cookie.slice(dot + 1), signature(sessionId));
}

export const prepCookieOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: env.secureCookies, path: "/", maxAge: 60 * 86_400 });

export async function progressFor(sessionId: string): Promise<Progress | null> {
  await ready();
  return (await db.query.prepProgress.findFirst({ where: eq(schema.prepProgress.sessionId, sessionId) })) ?? null;
}

async function upsert(sessionId: string, patch: Partial<Omit<Progress, "sessionId">>) {
  await db
    .insert(schema.prepProgress)
    .values({ sessionId, ...patch })
    .onConflictDoUpdate({ target: schema.prepProgress.sessionId, set: patch });
}

export async function touchProgress(sessionId: string) {
  const current = await progressFor(sessionId);
  const now = new Date();
  await upsert(sessionId, { openedAt: current?.openedAt ?? now, lastSeenAt: now });
}

export async function markSection(sessionId: string, sectionId: string, done: boolean) {
  const current = await progressFor(sessionId);
  const set = new Set(current?.sectionsDone ?? []);
  if (done) set.add(sectionId);
  else set.delete(sectionId);
  await upsert(sessionId, { sectionsDone: [...set], lastSeenAt: new Date(), openedAt: current?.openedAt ?? new Date() });
  return [...set];
}

export async function markStep(sessionId: string, mark: StepMark, on: boolean) {
  const current = await progressFor(sessionId);
  const stepsDone = applyMark(current?.stepsDone ?? [], mark, on);
  await upsert(sessionId, { stepsDone, lastSeenAt: new Date(), openedAt: current?.openedAt ?? new Date() });
  return stepsDone;
}

export async function recordPractice(sessionId: string, practiceSessionId: string, practiceToken: string) {
  await upsert(sessionId, { practiceSessionId, practiceToken });
}

export type PrepWindow = { state: "open" | "upcoming" | "closed"; opensAt: Date | null };

export function prepWindow(kit: Kit, session: Pick<SessionRow, "status" | "scheduledAt" | "inviteExpiresAt">, now = Date.now()): PrepWindow {
  const opensAt = prepOpensAt(kit, session.scheduledAt);
  if (session.status !== "invited" || session.inviteExpiresAt.getTime() < now) return { state: "closed", opensAt };
  if (opensAt && opensAt.getTime() > now) return { state: "upcoming", opensAt };
  return { state: "open", opensAt };
}
