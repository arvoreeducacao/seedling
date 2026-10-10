"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { audit, requireAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { sendInvite } from "@/lib/mail";
import { modelOptions } from "@/lib/pricing";
import { AppError, isLocale, messageOf } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { createInvite, extend, inviteExpiry, finish, logEvent, revokeAi, submitCurrent } from "@/lib/sessions";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type InviteResult = { ok: true; links: { email: string; url: string; mailed: boolean }[] } | { ok: false; error: string };

export async function inviteMany(_prev: InviteResult | null, formData: FormData): Promise<InviteResult> {
  const admin = await requireAdmin();
  const i18n = await getI18n();
  const { t } = i18n;
  const mode = formData.get("mode") === "async" ? "async" : "live";
  const inviteDays = mode === "async" ? 5 : 2;
  const asked = String(formData.get("locale") ?? "");
  const locale = isLocale(asked) ? asked : i18n.locale;
  const emails = [...new Set(String(formData.get("emails") ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const requested = formData.getAll("challenge").map(String).filter(Boolean);
  const minutes = Math.round(Number(formData.get("minutes") ?? 60));
  const budgetUsd = Number(formData.get("budget") ?? 5);
  const modelId = String(formData.get("model") ?? "");
  const scheduledRaw = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
  if (scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() - 3_600_000 || scheduledAt.getTime() > Date.now() + 120 * 86_400_000)) return { ok: false, error: t("invite.error.date") };
  if (!requested.length) return { ok: false, error: t("invite.pickChallenge") };
  if (!Number.isFinite(minutes) || minutes < 10 || minutes > 600) return { ok: false, error: t("invite.error.minutes") };
  if (!Number.isFinite(budgetUsd) || budgetUsd < 0.5 || budgetUsd > 100) return { ok: false, error: t("invite.error.budget") };
  const valid = emails.filter((e) => emailRe.test(e));
  if (!valid.length) return { ok: false, error: t("invite.error.email") };
  try {
    const published = await db.query.challenges.findMany({ where: and(inArray(schema.challenges.id, requested), eq(schema.challenges.status, "published")) });
    const challengeIds = requested.filter((id) => published.some((c) => c.id === id));
    if (challengeIds.length !== requested.length) return { ok: false, error: t("invite.error.unpublished") };
    const model = modelOptions.some((m) => m.id === modelId) ? modelId : modelOptions[0].id;
    const key = challengeIds.join(",");
    const existing = new Set(
      (await db.query.sessions.findMany({ where: and(inArray(schema.sessions.candidateEmail, valid), ne(schema.sessions.status, "cancelled"), isNull(schema.sessions.practiceOf)) }))
        .filter((s) => s.challengeIds.join(",") === key)
        .map((s) => s.candidateEmail),
    );
    const fresh = valid.filter((e) => !existing.has(e));
    if (!fresh.length) return { ok: false, error: t("invite.error.allTaken") };
    const links = [];
    for (const email of fresh) {
      const invite = await createInvite({ email, challengeIds, minutes, budgetUsd, model, mode, inviteDays, scheduledAt, locale, createdBy: admin.email });
      const mailed = await sendInvite({
        to: email,
        url: invite.url,
        challenges: challengeIds.length,
        minutes,
        mode,
        locale,
        expiresAt: inviteExpiry(inviteDays, scheduledAt),
      }).catch(() => false);
      await audit(admin.email, "sessions.audit.invited", invite.id);
      links.push({ email, url: invite.url, mailed });
    }
    revalidatePath("/");
    revalidatePath("/sessions");
    return { ok: true, links };
  } catch (error) {
    return { ok: false, error: messageOf(error, t, "invite.error.failed") };
  }
}

async function load(id: string) {
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, id) });
  if (!session) throw new AppError("error.notFound");
  return session;
}

export async function addTime(id: string) {
  const admin = await requireAdmin();
  await extend(await load(id), 10, admin.email);
  await audit(admin.email, "sessions.audit.addedTime", id);
}

export async function cutAi(id: string) {
  const admin = await requireAdmin();
  await revokeAi(await load(id), admin.email);
  await audit(admin.email, "sessions.audit.cutAi", id);
}

export async function endSession(id: string) {
  const admin = await requireAdmin();
  const session = await load(id);
  if (session.status === "running") await submitCurrent({ ...session, currentIndex: session.challengeIds.length - 1 }, admin.email).catch(() => finish(session, "submitted", "sessions.reason.endedByInterviewer"));
  else if (session.status === "invited") await finish(session, "cancelled", "sessions.reason.inviteCancelled");
  await audit(admin.email, "sessions.audit.ended", id);
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
