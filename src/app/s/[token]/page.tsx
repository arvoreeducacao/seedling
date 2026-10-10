import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { ArrowRight, CaretRight, Check, Eye, Sparkle, Toolbox, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getSetup } from "@/lib/setup/store";
import { anyEnabled, setupPolicy } from "@/lib/setup/policy";
import { db, schema } from "@/lib/db";
import { CANDIDATE_COOKIE, candidateOwns, sessionByInvite } from "@/lib/sessions";
import { dayAndTime, displayName } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import type { I18n, Key } from "@/lib/i18n";
import { sandbox } from "@/lib/sandbox";
import ui from "@/components/workspace/ui.module.css";
import css from "./landing.module.css";
import { StartCard } from "./start-card";
import { Appear } from "@/components/workspace/ai";
import { CodeCrystal, Sprout, Stage, Stopwatch } from "@/components/brand";
import { Frame } from "./frame";
import { kitIsEmpty } from "@/lib/prep/kit";
import { buildSteps, completion } from "@/lib/prep/steps";
import { loadKit, prepWindow, progressFor } from "@/lib/prep";
import { PrepClaim } from "./prepare/claim";
import prep from "./prep.module.css";

function Message({ i18n, title, text, spent = false }: { i18n: I18n; title: string; text: string; spent?: boolean }) {
  return (
    <Frame i18n={i18n}>
      <main className={css.center}>
        <div style={{ maxWidth: 460 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <Sprout mood="worried" size={112} />
            {spent && <Stopwatch progress={0} running={false} size={64} />}
          </div>
          <h1 className={css.display} style={{ fontSize: 28, lineHeight: 1.1, margin: "20px 0 0" }}>{title}</h1>
          <p className={ui.muted} style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>{text}</p>
        </div>
      </main>
    </Frame>
  );
}

const steps: { icon: React.ReactNode; title: Key; text: Key }[] = [
  { icon: <Eye size={15} />, title: "candidate.step.brief.title", text: "candidate.step.brief.text" },
  { icon: <Sparkle size={15} weight="fill" color="#d97757" />, title: "candidate.step.drive.title", text: "candidate.step.drive.text" },
  { icon: <Check size={15} weight="bold" />, title: "candidate.step.submit.title", text: "candidate.step.submit.text" },
];

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const i18n = await getI18n();
  const { t } = i18n;
  const session = await sessionByInvite(token);
  if (!session) return <Message i18n={i18n} title={t("candidate.linkMissing.title")} text={t("candidate.linkMissing.text")} />;
  const jar = await cookies();
  const owner = candidateOwns(session, jar.get(CANDIDATE_COOKIE)?.value);
  if (session.status === "running") {
    if (owner) redirect(`/s/${token}/w`);
    return <Message i18n={i18n} title={t("candidate.inUse.title")} text={t("candidate.inUse.text")} />;
  }
  if (session.status === "submitted" || session.status === "expired") redirect(`/s/${token}/fim`);
  if (session.status === "cancelled") return <Message i18n={i18n} title={t("candidate.cancelled.title")} text={t("candidate.cancelled.text")} />;
  if (session.inviteExpiresAt.getTime() < Date.now()) return <Message i18n={i18n} title={t("candidate.expired.title")} text={t("candidate.expired.text")} spent />;
  const challenges = await db.query.challenges.findMany({ where: inArray(schema.challenges.id, session.challengeIds) });
  const ordered = session.challengeIds.map((id) => challenges.find((c) => c.id === id)!).filter(Boolean);
  const runtime = await sandbox().available();
  const job = session.jobId ? await db.query.jobs.findFirst({ where: eq(schema.jobs.id, session.jobId) }) : null;
  const [brought, policy] = await Promise.all([getSetup(session.id), setupPolicy()]);
  const broughtCount = brought.skills.length + brought.mcpServers.length + (brought.claudeMd ? 1 : 0);
  const first = displayName(session.candidateEmail, session.candidateName).split(" ")[0];
  const expires = dayAndTime(i18n, session.inviteExpiresAt);
  const [kit, progress] = session.practiceOf ? [null, null] : await Promise.all([loadKit(), progressFor(session.id)]);
  const hasPrep = Boolean(kit && !kitIsEmpty(kit));
  const prepState = kit ? prepWindow(kit, session) : null;
  const prepProgress = kit ? completion(buildSteps({ sections: kit.sections.map((s) => s.id), bring: anyEnabled(policy), practice: kit.practice.enabled }, { sectionsDone: progress?.sectionsDone ?? [], stepsDone: progress?.stepsDone ?? [], broughtItems: broughtCount, practiceUsed: Boolean(progress?.practiceSessionId) })) : null;
  const checks: [string, boolean][] = [
    [t("candidate.check.sandbox"), runtime.ok],
    [t("candidate.check.budget"), true],
    [t("candidate.check.device"), true],
  ];
  return (
    <Frame i18n={i18n} email={session.candidateEmail} nav={hasPrep && prepProgress ? { token, active: "interview", done: prepProgress.done, total: prepProgress.total } : undefined}>
      {hasPrep && <PrepClaim token={token} />}
      <main className={css.stage}>
        <section className={css.hero}>
          <Stage className={css.heroCopy}>
            <Stage.Actor at="top-right" out={0.1} inset={8} delay={0.5}><CodeCrystal glyph="braces" hue="violet" tilt={-10} size={64} /></Stage.Actor>
            <Stage.Actor at="bottom-right" out={0} inset={48} delay={0.7}><CodeCrystal glyph="angle" hue="mint" tilt={12} size={44} /></Stage.Actor>
            <Appear>
              <span className={css.eyebrow}>
                {job ? <span className={ui.chip}>{job.name}</span> : null}
                <span>{t("candidate.eyebrow")}</span>
              </span>
            </Appear>
            <Appear delay={0.06}>
              <h1 className={css.h1}>{t("candidate.hello", { name: first })}<br /><em>{t("candidate.helloLine2")}</em></h1>
            </Appear>
            <Appear delay={0.12}>
              <p className={css.lead}>{t("candidate.lead")}</p>
            </Appear>
            <Appear delay={0.18}>
              <div className={css.facts}>
                <div className={css.fact}><span className={css.factValue}>{ordered.length}</span><span className={css.factLabel}>{t("candidate.fact.challenges", { n: ordered.length })}</span></div>
                <span className={css.factDivider} />
                <div className={css.fact}><span className={css.factValue}>{session.minutes}</span><span className={css.factLabel}>{t("candidate.fact.minutes")}</span></div>
                <span className={css.factDivider} />
                <div className={css.fact}><span className={css.factValue}>${session.budgetUsd}</span><span className={css.factLabel}>{t("candidate.fact.budget")}</span></div>
              </div>
            </Appear>
          </Stage>
          <Appear delay={0.1} y={16} className={css.cardWrap}>
            <Stage>
            <Stage.Actor at="top-left" out={0.6} inset={40} delay={0.35}><Sprout mood="waving" size={132} label={t("candidate.sprout.waving")} /></Stage.Actor>
            <aside className={`${css.card} ${css.startCard}`} data-el="start-card">
              <div className={ui.sectionLabel}>{t("candidate.beforeYouStart")}</div>
              <div data-el="environment-check" className={css.checks}>
                {checks.map(([label, ok]) => (
                  <div key={label} className={css.checkRow}>
                    <span className={css.checkDot} style={{ background: ok ? "var(--w-ok-soft)" : "var(--w-err-soft)", color: ok ? "var(--w-ok)" : "var(--w-err)" }}>{ok ? <Check size={11} weight="bold" /> : <X size={11} weight="bold" />}</span>
                    {label}
                  </div>
                ))}
              </div>
              {anyEnabled(policy) && (
                <Link href={hasPrep ? `/s/${token}/prepare?step=setup` : `/s/${token}/setup`} className={css.checkRow} style={{ textDecoration: "none", color: "var(--w-fg-2)", margin: "16px 0 14px", padding: "10px 12px", borderRadius: "var(--w-r-sm)", border: "1px solid var(--w-line-2)", background: "var(--w-raised)" }} data-el="bring-setup-link">
                  <span className={css.checkDot} style={{ background: "var(--w-accent-soft)", color: "var(--w-accent-2)" }}><Toolbox size={11} weight="bold" /></span>
                  {broughtCount ? t("candidate.setupReady", { n: broughtCount }) : t("candidate.setupEmpty")}
                  <CaretRight size={11} style={{ marginLeft: "auto" }} />
                </Link>
              )}
              <StartCard token={token} expires={expires} />
            </aside>
            </Stage>
          </Appear>
        </section>

        {hasPrep && kit && (
          <Appear delay={0.2}>
            <Link href={`/s/${token}/prepare`} className={prep.callout} data-el="prep-callout">
              <span className={prep.calloutIcon}><Sprout mood="idle" size={44} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className={prep.calloutTitle}>{prepState?.state === "upcoming" ? t("candidate.callout.opensSoon") : prepProgress && prepProgress.done === 0 ? t("candidate.callout.start") : prepProgress && prepProgress.done >= prepProgress.total ? t("candidate.callout.done") : t("candidate.callout.partial", { pct: prepProgress?.pct ?? 0 })}</span>
                <span className={prep.calloutText}>
                  {[t("candidate.callout.howTeamWorks"), kit.sections.length ? t("candidate.callout.reads", { n: kit.sections.length }) : null, kit.practice.mode === "playground" ? t("candidate.callout.playground") : kit.practice.enabled ? t("candidate.callout.practice") : null, anyEnabled(policy) ? (broughtCount ? t("candidate.callout.setupReady") : t("candidate.callout.setupEmpty")) : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className={prep.calloutGo}>{t("candidate.callout.go")} <ArrowRight size={14} weight="bold" /></span>
            </Link>
          </Appear>
        )}

        <section className={css.band} aria-label={t("candidate.howItWorks")}>
          {steps.map((step, i) => (
            <Appear key={step.title} delay={0.24 + i * 0.06} className={css.bandStep}>
              <div className={css.bandHead}>
                <span className={css.bandNum}>{String(i + 1).padStart(2, "0")}</span>
                <span className={css.stepIcon}>{step.icon}</span>
              </div>
              <div className={css.stepTitle}>{t(step.title)}</div>
              <div className={css.stepText}>{t(step.text)}</div>
            </Appear>
          ))}
        </section>

        <section className={css.lower}>
          <Appear delay={0.36}>
            <div className={css.sectionHead}>
              <span className={ui.sectionLabel}>{t("candidate.yourSession")}</span>
              <span className={ui.faint} style={{ fontSize: 12 }}>{t("candidate.carryOver")}</span>
            </div>
            <div className={css.card} data-el="roadmap">
              {ordered.map((c, i) => (
                <div key={c.id} className={css.row}>
                  <span className={css.num} style={{ color: i === 0 ? "var(--w-accent-2)" : undefined }}>{String(i + 1).padStart(2, "0")}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: i === 0 ? "var(--w-head)" : "var(--w-fg-2)" }}>{i === 0 ? c.title : t("candidate.locked")}</div>
                    <div className={ui.faint} style={{ fontSize: 12, marginTop: 2 }}>{i === 0 ? `${c.kind === "screen" ? t("prep.ui") : t("kind.code.title")} · ${c.runtime}` : t("candidate.lockedMeta")}</div>
                  </div>
                  <span className={`${ui.mono} ${ui.muted}`}>{c.minutes} {t("common.minutes")}</span>
                </div>
              ))}
            </div>
          </Appear>
          <Appear delay={0.42}>
            <div className={css.sectionHead}>
              <span className={ui.sectionLabel}>{t("candidate.rules")}</span>
            </div>
            <div className={`${css.card} ${css.rules}`} data-el="rules">
              <div className={css.rule}><span className={css.ruleDot} style={{ background: "var(--w-ok)" }} /><div><b>{t("candidate.rule.allowed.title")}</b> {t("candidate.rule.allowed.text")}</div></div>
              <div className={css.rule}><span className={css.ruleDot} style={{ background: "var(--w-warn)" }} /><div><b>{t("candidate.rule.recorded.title")}</b> {t("candidate.rule.recorded.text")}</div></div>
              <div className={css.rule} data-el="ai-window"><span className={css.ruleDot} style={{ background: "var(--w-accent)" }} /><div><b>{t("candidate.rule.window.title")}</b> {t("candidate.rule.window.text", { n: session.minutes })}</div></div>
            </div>
          </Appear>
        </section>
      </main>
    </Frame>
  );
}
