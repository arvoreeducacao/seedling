import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { practiceSession, sessionByInvite } from "@/lib/sessions";
import { getSetup } from "@/lib/setup/store";
import { buildSteps, completion } from "@/lib/prep/steps";
import { dayAndTime, displayName } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { renderMarkdown } from "@/lib/markdown";
import { loadKit, prepWindow, progressFor } from "@/lib/prep";
import { kitIsEmpty } from "@/lib/prep/kit";
import { anyEnabled, setupPolicy } from "@/lib/setup/policy";
import ui from "@/components/workspace/ui.module.css";
import { Sprout } from "@/components/brand";
import css from "../landing.module.css";
import prep from "../prep.module.css";
import { Frame } from "../frame";
import { PrepClaim } from "./claim";
import { Countdown } from "./countdown";
import { PrepFlow } from "./flow";
import type { PracticeOffer } from "./practice";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("prep.pageTitle") };
}

export default async function PreparePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const session = await sessionByInvite(token);
  if (!session || session.practiceOf || session.status !== "invited" || session.inviteExpiresAt.getTime() < Date.now()) redirect(`/s/${token}`);
  const i18n = await getI18n();
  const { t } = i18n;
  const kit = await loadKit();
  if (kitIsEmpty(kit)) redirect(`/s/${token}`);
  const [progress, job, practiceChallenge, policy, brought, practiceFound] = await Promise.all([
    progressFor(session.id),
    session.jobId ? db.query.jobs.findFirst({ where: eq(schema.jobs.id, session.jobId) }) : null,
    kit.practice.mode === "challenge" && kit.practice.challengeId ? db.query.challenges.findFirst({ where: eq(schema.challenges.id, kit.practice.challengeId) }) : null,
    setupPolicy(),
    getSetup(session.id),
    practiceSession(session.id),
  ]);
  const practiceRun = practiceFound?.practice ?? null;
  const broughtItems = brought.skills.length + brought.mcpServers.length + (brought.claudeMd ? 1 : 0);
  const prepState = prepWindow(kit, session);
  const first = displayName(session.candidateEmail, session.candidateName).split(" ")[0];
  const done = kit.sections.filter((s) => progress?.sectionsDone.includes(s.id)).map((s) => s.id);
  const practice: PracticeOffer | null =
    kit.practice.mode === "playground"
      ? { mode: "playground", minutes: kit.practice.minutes, budgetUsd: kit.practice.budgetUsd, title: null, kind: null, runtime: null }
      : kit.practice.mode === "challenge" && practiceChallenge?.status === "published"
        ? { mode: "challenge", minutes: kit.practice.minutes, budgetUsd: kit.practice.budgetUsd, title: practiceChallenge.title, kind: practiceChallenge.kind, runtime: practiceChallenge.runtime }
        : null;
  const unitProgress = completion(buildSteps({ sections: kit.sections.map((s) => s.id), bring: anyEnabled(policy), practice: Boolean(practice) }, { sectionsDone: done, stepsDone: progress?.stepsDone ?? [], broughtItems, practiceUsed: Boolean(practiceRun && practiceRun.status !== "cancelled") }));
  const nav = { token, active: "prepare" as const, done: unitProgress.done, total: prepState.state === "upcoming" ? unitProgress.total : undefined };
  const target = session.scheduledAt ?? null;

  if (prepState.state === "upcoming" && prepState.opensAt) {
    return (
      <Frame i18n={i18n} email={session.candidateEmail} nav={nav}>
        <PrepClaim token={token} />
        <main className={css.center}>
          <div style={{ maxWidth: 480 }} data-el="prep-locked">
            <Sprout mood="sleeping" size={112} label={t("candidate.sprout.sleeping")} />
            <h1 className={css.display} style={{ fontSize: 30, lineHeight: 1.1, margin: "20px 0 0" }}>{t("prep.locked.title")}</h1>
            <p className={ui.muted} style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>
              {t("prep.locked.text", { when: dayAndTime(i18n, prepState.opensAt), n: kit.opensDaysBefore })}
            </p>
            <div style={{ marginTop: 20 }}><Countdown target={prepState.opensAt.toISOString()} label={t("prep.locked.countdown")} /></div>
          </div>
        </main>
      </Frame>
    );
  }

  const bring = anyEnabled(policy);
  const query = await searchParams;

  return (
    <Frame i18n={i18n} email={session.candidateEmail} nav={nav}>
      <PrepClaim token={token} />
      <PrepFlow
        token={token}
        first={first}
        kitName={kit.name || t("prep.kitName")}
        jobName={job?.name ?? null}
        welcomeHtml={kit.howWeWork.trim() ? renderMarkdown(kit.howWeWork) : ""}
        sections={kit.sections.map((s) => ({ id: s.id, title: s.title, html: renderMarkdown(s.body), links: s.links.map((l) => ({ ...l, host: hostOf(l.url) })) }))}
        bring={bring}
        practice={practice}
        initial={{ sectionsDone: done, stepsDone: progress?.stepsDone ?? [], broughtItems, practiceUsed: Boolean(practiceRun && practiceRun.status !== "cancelled") }}
        target={target ? target.toISOString() : null}
        expiresAt={session.inviteExpiresAt.toISOString()}
        requested={{ step: typeof query.step === "string" ? query.step : null, section: typeof query.section === "string" ? query.section : null }}
      />
    </Frame>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
