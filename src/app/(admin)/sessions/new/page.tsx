import type { Metadata } from "next";
import { desc, eq, isNull } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { challengeTitle, levelLabel } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { mailConfigured } from "@/lib/mail";
import { modelOptions } from "@/lib/pricing";
import { loadKit } from "@/lib/prep";
import { InviteForm } from "./invite-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("invite.pageTitle") };
}

export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const i18n = await getI18n();
  const { from } = await searchParams;
  const [challenges, sessions, source, kit] = await Promise.all([
    db.query.challenges.findMany({ where: eq(schema.challenges.status, "published"), orderBy: desc(schema.challenges.createdAt) }),
    db.query.sessions.findMany({ where: isNull(schema.sessions.practiceOf), columns: { candidateEmail: true, challengeIds: true, status: true } }),
    from ? db.query.sessions.findFirst({ where: eq(schema.sessions.id, from) }) : undefined,
    loadKit(),
  ]);
  return (
    <>
      <PageHeader crumb={i18n.t("sessions.title")} crumbHref="/sessions" title={i18n.t("invite.heading")} />
      <InviteForm
        challenges={challenges.map((c) => ({ id: c.id, title: challengeTitle(i18n, c.title), level: c.level, levelLabel: levelLabel(i18n, c.level), kind: c.kind, minutes: c.minutes, runtime: c.runtime }))}
        models={modelOptions}
        taken={sessions.filter((s) => s.status !== "cancelled").map((s) => ({ email: s.candidateEmail, key: s.challengeIds.join(",") }))}
        mailOn={mailConfigured()}
        initial={source ? { challengeIds: source.challengeIds, minutes: source.minutes, budgetUsd: source.budgetUsd, model: source.model, mode: source.mode } : undefined}
        box={{ cpus: env.sandbox.cpus, memoryMb: env.sandbox.memoryMb }}
        prepDays={kit.opensDaysBefore}
        adminLocale={i18n.locale}
        orgName={env.orgName}
      />
    </>
  );
}
