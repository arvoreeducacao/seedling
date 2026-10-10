import { asc, eq, inArray } from "drizzle-orm";
import { Check, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { sessionByInvite } from "@/lib/sessions";
import { displayName, elapsed, time } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { isPlayground } from "@/lib/prep/playground";
import ui from "@/components/workspace/ui.module.css";
import css from "../landing.module.css";
import { Appear } from "@/components/workspace/ai";
import { Logo, Sprout, Stage, Starfield, Stopwatch } from "@/components/brand";

export default async function EndPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const i18n = await getI18n();
  const { t } = i18n;
  const session = await sessionByInvite(token);
  if (!session || (session.status !== "submitted" && session.status !== "expired")) {
    return (
      <main className={`${ui.root} ${ui.loading}`}>
        <span className={ui.muted}>{t("candidate.end.nothing")}</span>
      </main>
    );
  }
  if (session.practiceOf) {
    return (
      <div className={`${ui.root} ${css.page}`}>
        <div className={css.sky} aria-hidden="true"><Starfield stars={120} aurora /></div>
        <header className={css.top}><Logo size={32} /></header>
        <main className={css.center}>
          <div style={{ maxWidth: 460 }} data-el="practice-done">
            <Sprout mood="celebrating" size={112} label={t("candidate.sprout.celebrating")} />
            <h1 className={css.display} style={{ fontSize: 30, lineHeight: 1.1, margin: "20px 0 0" }}>{isPlayground(session) ? t("candidate.end.playgroundClosed") : t("candidate.end.practiceFinished")}</h1>
            <p className={ui.muted} style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>{t("candidate.end.practiceText")}</p>
          </div>
        </main>
      </div>
    );
  }
  const [attempts, challenges, passes] = await Promise.all([
    db.query.attempts.findMany({ where: eq(schema.attempts.sessionId, session.id), orderBy: asc(schema.attempts.index) }),
    db.query.challenges.findMany({ where: inArray(schema.challenges.id, session.challengeIds) }),
    db.query.passes.findMany({ where: eq(schema.passes.sessionId, session.id) }),
  ]);
  const revokedAt = passes.map((p) => p.revokedAt).filter(Boolean).sort().pop() ?? session.endedAt;
  const first = displayName(session.candidateEmail, session.candidateName).split(" ")[0];
  const delivered = attempts.filter((a) => a.submittedAt).length;
  const expired = session.status === "expired";
  return (
    <div className={`${ui.root} ${css.page}`}>
      <div className={css.sky} aria-hidden="true"><Starfield stars={120} aurora shooting={!expired} /></div>
      <header className={css.top}>
        <Logo size={32} />
        {env.orgName !== "Seedling" && <span className={ui.faint} style={{ fontSize: 13 }}>{t("candidate.forOrg", { org: env.orgName })}</span>}
      </header>
      <main className={css.center}>
        <div className={css.done}>
          <h1 className={css.display} style={{ fontSize: 34, lineHeight: 1.05, margin: 0 }}>
            {expired ? t("candidate.end.expired", { name: first }) : delivered > 1 ? t("candidate.end.doneMany", { name: first, count: delivered }) : t("candidate.end.doneOne", { name: first })}
          </h1>
          <p className={ui.muted} style={{ fontSize: 15, marginTop: 10, lineHeight: 1.6 }}>{t("candidate.end.text")}</p>
          <Appear delay={0.15}>
          <Stage style={{ marginTop: 88 }}>
          <Stage.Actor at="top-right" out={0.62} inset={32} delay={0.3}>
            <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 4 }}>
              {expired && <Stopwatch progress={0} running={false} size={60} />}
              <Sprout mood={expired ? "worried" : "celebrating"} size={128} label={expired ? t("candidate.sprout.worried") : t("candidate.sprout.celebrating")} />
            </span>
          </Stage.Actor>
          <div className={css.card} data-el="submission-summary">
            {session.challengeIds.map((id, i) => {
              const a = attempts.find((x) => x.index === i);
              const c = challenges.find((x) => x.id === id);
              return (
                <div key={id} className={css.row}>
                  <span className={css.num}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ flex: 1, minWidth: 0 }} className={ui.ellipsis}>{c?.title}</span>
                  {a?.submittedAt ? (
                    <span className={`${ui.chip} ${ui.chipOk}`}><Check size={10} weight="bold" /><span className={ui.mono}>{elapsed(a.startedAt, a.submittedAt)}</span></span>
                  ) : (
                    <span className={ui.chip}>{a ? t("candidate.end.notSubmitted") : t("candidate.end.notOpened")}</span>
                  )}
                </div>
              );
            })}
          </div>
          </Stage>
          </Appear>
          <Appear delay={0.25}>
          <div data-el="ai-revoked" className={ui.callout} style={{ display: "flex", gap: 12, marginTop: 12, padding: "14px 16px" }}>
            <span className={ui.muted} style={{ display: "flex", marginTop: 1 }}><LockSimple size={16} /></span>
            <div className={ui.muted} style={{ lineHeight: 1.55 }}>
              <b style={{ color: "var(--w-fg)", fontWeight: 500 }}>{revokedAt ? t("candidate.end.revokedAt", { when: time(i18n, revokedAt) }) : t("candidate.end.revoked")}</b> {t("candidate.end.revokedText")}
            </div>
          </div>
          </Appear>
        </div>
      </main>
    </div>
  );
}
