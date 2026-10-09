"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { audit, requireAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { sendInvite } from "@/lib/mail";
import { modelOptions } from "@/lib/pricing";
import { createInvite, extend, inviteExpiry, finish, logEvent, revokeAi, submitCurrent } from "@/lib/sessions";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type InviteResult = { ok: true; links: { email: string; url: string; mailed: boolean }[] } | { ok: false; error: string };

export async function inviteMany(_prev: InviteResult | null, formData: FormData): Promise<InviteResult> {
  const admin = await requireAdmin();
  const mode = formData.get("mode") === "async" ? "async" : "live";
  const inviteDays = mode === "async" ? 5 : 2;
  const emails = [...new Set(String(formData.get("emails") ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const requested = formData.getAll("challenge").map(String).filter(Boolean);
  const minutes = Math.round(Number(formData.get("minutes") ?? 60));
  const budgetUsd = Number(formData.get("budget") ?? 5);
  const modelId = String(formData.get("model") ?? "");
  const scheduledRaw = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
  if (scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() - 3_600_000 || scheduledAt.getTime() > Date.now() + 120 * 86_400_000)) return { ok: false, error: "Pick an interview date in the next 120 days, or leave it empty." };
  if (!requested.length) return { ok: false, error: "Pick at least one challenge." };
  if (!Number.isFinite(minutes) || minutes < 10 || minutes > 600) return { ok: false, error: "Total time must be between 10 and 600 minutes." };
  if (!Number.isFinite(budgetUsd) || budgetUsd < 0.5 || budgetUsd > 100) return { ok: false, error: "AI budget must be between $0.50 and $100." };
  const valid = emails.filter((e) => emailRe.test(e));
  if (!valid.length) return { ok: false, error: "Add at least one valid email." };
  try {
    const published = await db.query.challenges.findMany({ where: and(inArray(schema.challenges.id, requested), eq(schema.challenges.status, "published")) });
    const challengeIds = requested.filter((id) => published.some((c) => c.id === id));
    if (challengeIds.length !== requested.length) return { ok: false, error: "One of the challenges is no longer published. Reload and pick again." };
    const model = modelOptions.some((m) => m.id === modelId) ? modelId : modelOptions[0].id;
    const key = challengeIds.join(",");
    const existing = new Set(
      (await db.query.sessions.findMany({ where: and(inArray(schema.sessions.candidateEmail, valid), ne(schema.sessions.status, "cancelled"), isNull(schema.sessions.practiceOf)) }))
        .filter((s) => s.challengeIds.join(",") === key)
        .map((s) => s.candidateEmail),
    );
    const fresh = valid.filter((e) => !existing.has(e));
    if (!fresh.length) return { ok: false, error: "Everyone on the list was already invited to this exact set of challenges." };
    const links = [];
    for (const email of fresh) {
      const invite = await createInvite({ email, challengeIds, minutes, budgetUsd, model, mode, inviteDays, scheduledAt, createdBy: admin.email });
      const mailed = await sendInvite({
        to: email,
        url: invite.url,
        challenges: challengeIds.length,
        minutes,
        mode,
        expiresAt: inviteExpiry(inviteDays, scheduledAt),
      }).catch(() => false);
      await audit(admin.email, "invited", invite.id);
      links.push({ email, url: invite.url, mailed });
    }
    revalidatePath("/");
    revalidatePath("/sessions");
    return { ok: true, links };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't create the invites." };
  }
}

async function load(id: string) {
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, id) });
  if (!session) throw new Error("session not found");
  return session;
}

export async function addTime(id: string) {
  const admin = await requireAdmin();
  await extend(await load(id), 10, admin.email);
  await audit(admin.email, "added 10 min", id);
}

export async function cutAi(id: string) {
  const admin = await requireAdmin();
  await revokeAi(await load(id), admin.email);
  await audit(admin.email, "turned off AI", id);
}

export async function endSession(id: string) {
  const admin = await requireAdmin();
  const session = await load(id);
  if (session.status === "running") await submitCurrent({ ...session, currentIndex: session.challengeIds.length - 1 }, admin.email).catch(() => finish(session, "submitted", "ended by the interviewer"));
  else if (session.status === "invited") await finish(session, "cancelled", "invite cancelled");
  await audit(admin.email, "ended session", id);
  revalidatePath(`/sessions/${id}`);
}

export async function addNote(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const text = String(formData.get("note") ?? "").trim();
  if (text) await logEvent(id, "note", admin.email, { text });
}

export async function messageCandidate(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const text = String(formData.get("message") ?? "").trim();
  if (text) await logEvent(id, "message", admin.email, { text });
}
