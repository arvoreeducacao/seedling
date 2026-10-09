import type { Metadata } from "next";
import { desc, eq, isNull } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { levelLabel } from "@/lib/format";
import { mailConfigured } from "@/lib/mail";
import { modelOptions } from "@/lib/pricing";
import { loadKit } from "@/lib/prep";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Invite" };

export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const [challenges, sessions, source, kit] = await Promise.all([
    db.query.challenges.findMany({ where: eq(schema.challenges.status, "published"), orderBy: desc(schema.challenges.createdAt) }),
    db.query.sessions.findMany({ where: isNull(schema.sessions.practiceOf), columns: { candidateEmail: true, challengeIds: true, status: true } }),
    from ? db.query.sessions.findFirst({ where: eq(schema.sessions.id, from) }) : undefined,
    loadKit(),
  ]);
  return (
    <>
      <PageHeader crumb="Sessions" crumbHref="/sessions" title="Invite candidates" />
      <InviteForm
        challenges={challenges.map((c) => ({ id: c.id, title: c.title, level: c.level, levelLabel: levelLabel[c.level], kind: c.kind, minutes: c.minutes, runtime: c.runtime }))}
        models={modelOptions}
        taken={sessions.filter((s) => s.status !== "cancelled").map((s) => ({ email: s.candidateEmail, key: s.challengeIds.join(",") }))}
        mailOn={mailConfigured()}
        initial={source ? { challengeIds: source.challengeIds, minutes: source.minutes, budgetUsd: source.budgetUsd, model: source.model, mode: source.mode } : undefined}
        box={{ cpus: env.sandbox.cpus, memoryMb: env.sandbox.memoryMb }}
        prepDays={kit.opensDaysBefore}
      />
    </>
  );
}
