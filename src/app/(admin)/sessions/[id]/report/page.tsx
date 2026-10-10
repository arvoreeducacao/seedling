import { groupTurns } from "@/lib/calls";
import { agentRows } from "@/lib/agents";
import { parallelism } from "@/lib/parallel";
import { ParallelReport, type Produced } from "@/components/parallel-report";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { MinuteStrip } from "@/components/minute-strip";
import { Rating } from "@/components/rating";
import { IconLock } from "@/components/icons";
import { AutoRefresh } from "@/components/auto-refresh";
import { requireAdmin } from "@/lib/auth";
import { sessionDetail } from "@/lib/sessions";
import { criteria, minuteStrip } from "@/lib/evaluation";
import { challengeTitle, displayName, elapsed, initials, money, when } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { modelLabel } from "@/lib/pricing";
import { env } from "@/lib/env";
import { PrepSummary } from "@/components/prep-summary";
import { decide, generateDefense, saveEvaluation } from "./actions";
import { setupView } from "@/lib/setup/store";
import { SetupSummary } from "@/components/setup/setup-summary";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("report.metaTitle") };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const i18n = await getI18n();
  const { t } = i18n;
  const { id } = await params;
  const detail = await sessionDetail(id);
  if (!detail) notFound();
  const { session, attempts, challenges, calls, events, evaluations, spent } = detail;
  const hiddenPassed = attempts.reduce((s, a) => s + (a.hiddenPassed ?? 0), 0);
  const hiddenTotal = attempts.reduce((s, a) => s + (a.hiddenTotal ?? 0), 0);
  const grading = attempts.some((a) => a.submittedAt && a.hiddenTotal === null && challenges[a.index]?.hiddenTestCommand);
  const traps = [...new Set(challenges.flatMap((c) => c.traps))];
  const found = new Set(evaluations.flatMap((e) => e.trapsFound));
  const mine = evaluations.find((e) => e.evaluator === admin.email);
  const others = evaluations.filter((e) => e.evaluator !== admin.email);
  const { turns } = groupTurns(calls.map((c) => ({ id: c.id, at: new Date(c.createdAt).toISOString(), source: c.source, prompt: c.prompt, response: c.response, tools: c.toolUses ?? [], cost: c.costUsd, status: c.status, agent: c.agentKey })));
  const extraAgents = await agentRows(id);
  const setup = await setupView(id);
  const agentNames = new Map([["main", t("workspace.agentMain")], ...extraAgents.map((a) => [a.key, a.name] as [string, string])]);
  const produced: Record<string, Produced> = {};
  for (const e of events) {
    if (e.kind !== "agent-merge" && e.kind !== "agent-close") continue;
    const key = String(e.data.agent ?? "");
    const summary = { files: Array.isArray(e.data.files) ? e.data.files.length : 0, added: Number(e.data.added ?? 0), removed: Number(e.data.removed ?? 0) };
    if (e.kind === "agent-merge") produced[key] = { ...summary, merged: true };
    else if (!produced[key]?.merged) produced[key] = { ...summary, merged: Boolean(e.data.merged) };
  }
  const parallel =
    extraAgents.length && session.startedAt
      ? parallelism({
          start: session.startedAt.getTime(),
          end: (session.endedAt ?? new Date()).getTime(),
          agents: [{ key: "main", name: t("workspace.agentMain"), openedAt: session.startedAt.getTime(), closedAt: null }, ...extraAgents.map((a) => ({ key: a.key, name: a.name, openedAt: a.createdAt.getTime(), closedAt: a.closedAt?.getTime() ?? null }))],
          turns,
        })
      : null;
  const strip = minuteStrip(session.startedAt, session.endedAt, events, calls);
  const pastes = events.filter((e) => e.kind === "paste" || e.kind === "apply-ai");
  const used = session.startedAt && session.endedAt ? elapsed(session.startedAt, session.endedAt) : "—";
  const decisionLabel = { advance: ["pill-ok", t("decision.advanced")], talk: ["pill-warn", t("decision.talked")], reject: ["", t("decision.rejected")] } as const;
  const sub = <span className="faint" style={{ fontWeight: 400 }}> / </span>;
  return (
    <>
      {grading && <AutoRefresh ms={3000} />}
      <PageHeader
        crumb={t("report.crumb")} crumbHref="/sessions"
        title={displayName(session.candidateEmail, session.candidateName)}
        extra={
          <>
            <span className="pill">{session.status === "expired" ? t("report.timeRanOut") : t("report.finished")} · {when(i18n, session.endedAt)}</span>
            <span className="pill" data-el="token-revoked" title={t("report.passRevokedTitle")}><IconLock size={10} />{t("report.passRevoked")}</span>
            {session.decision && <span className={`pill ${decisionLabel[session.decision][0]}`}>{decisionLabel[session.decision][1]}</span>}
          </>
        }
        actions={
          <>
            <Link href={`/sessions/new?from=${session.id}`} className="btn btn-ghost">{t("report.reuseSetup")}</Link>
            {env.anthropicKey && <form action={generateDefense.bind(null, id)}><button className="btn btn-primary" data-el="follow-up-questions">{session.defenseQuestions?.length ? t("report.regenerateQuestions") : t("report.generateQuestions")}</button></form>}
          </>
        }
      />
      <div className="page" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 24, alignItems: "start",  }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          <div data-el="scoreboard" className="stats">
            {[
              [t("report.hiddenTests"), grading ? <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>{t("report.grading")}</span> : <>{hiddenPassed}{sub}<span className="faint">{hiddenTotal}</span></>, hiddenTotal ? t("report.percentPassing", { pct: Math.round((hiddenPassed / hiddenTotal) * 100) }) : t("report.noHiddenTests")],
              [t("report.trapsFound"), traps.length ? <>{found.size}{sub}<span className="faint">{traps.length}</span></> : "—", traps.length ? t("report.fromRubric") : t("report.noTrapsInRubric")],
              [t("report.timeUsed"), <span className="num" key="t">{used}</span>, t("report.ofMinutes", { n: session.minutes + session.extraMinutes })],
              [t("report.aiSpend"), <span key="s" className="num">{money(i18n, spent)}</span>, `${t("report.aiRequests", { n: turns.length })} · ${modelLabel(session.model)}`],
            ].map(([label, value, foot], i) => (
              <div key={i}>
                <span className="label">{label}</span>
                <div className="stat-value" style={{ fontSize: 24, whiteSpace: "nowrap" }}>{value}</div>
                <div className="faint truncate" style={{ fontSize: 12, marginTop: 4 }} title={String(foot)}>{foot}</div>
              </div>
            ))}
          </div>

          <div className="card" data-el="challenge-results">
            <div className="card-head">{t("report.challenges")}<span className="count">{challenges.length}</span></div>
            {challenges.map((c, i) => {
              const a = attempts.find((x) => x.index === i);
              const ratio = a?.hiddenTotal ? (a.hiddenPassed ?? 0) / a.hiddenTotal : null;
              const p = pastes.filter((e) => a?.startedAt && e.createdAt >= a.startedAt && (!a.submittedAt || e.createdAt <= a.submittedAt)).length;
              return (
                <details key={c.id} style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
                  <summary style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer", listStyle: "none" }} className="hover:!bg-white/[.02]">
                    <span className="step-num">{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate" style={{ fontWeight: 500 }}>{challengeTitle(i18n, c.title)}</div>
                      <div className="faint truncate" style={{ fontSize: 12 }}>{a?.submittedAt ? t("report.submittedAfter", { elapsed: elapsed(a.startedAt, a.submittedAt) }) : t("report.notSubmitted")} · {a?.hiddenTotal ? t("report.hiddenTestsPassed", { passed: a.hiddenPassed ?? 0, n: a.hiddenTotal }) : t("report.noHiddenTestResults")} · {t("report.pastes", { n: p })}</div>
                    </div>
                    {ratio !== null && <span className={`pill ${ratio >= 0.85 ? "pill-ok" : ratio >= 0.5 ? "pill-warn" : "pill-err"}`}>{ratio >= 0.85 ? t("report.strong") : ratio >= 0.5 ? t("report.check") : t("report.weak")}</span>}
                  </summary>
                  {a?.hiddenOutput && <pre className="mono scroll-thin" style={{ margin: "0 16px 16px", padding: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 11.5, maxHeight: 280, overflow: "auto", color: "var(--text-2)" }}>{a.hiddenOutput}</pre>}
                </details>
              );
            })}
          </div>

          <PrepSummary sessionId={session.id} />

          <div className="card" data-el="ai-usage">
            <div className="card-head">{t("report.aiUsage")}<span className="aside">{t("report.oneBlockPerMinute", { n: strip.length })}</span></div>
            <div className="card-body">
              <MinuteStrip strip={strip} i18n={i18n} />
              {pastes.length > 0 && <div className="notice notice-warn" style={{ marginTop: 16 }}><b style={{ color: "var(--warn)", fontWeight: 500 }}>{t("report.pasteWarning", { n: pastes.length })}</b>{t("report.pasteWarningTail")}</div>}
            </div>
          </div>

          <SetupSummary view={setup} />

          {parallel && <ParallelReport data={parallel} produced={produced} i18n={i18n} />}

          <div className="card">
            <div className="card-head">{t("report.requestsToClaude")}<span className="count">{turns.length}</span>{parallel && <span className="aside">{t("report.taggedByAgent")}</span>}</div>
            <div className="scroll-thin" style={{ maxHeight: 520, overflowY: "auto" }}>
              {turns.length === 0 && <div className="list-item faint">{t("report.noRequests")}</div>}
              {turns.map((turn, i) => (
                <details key={turn.id} style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
                  <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", fontSize: 12.5, listStyle: "none" }} className="hover:!bg-white/[.02]">
                    <span className="num faint" style={{ width: 44, flex: "none" }}>{session.startedAt ? elapsed(session.startedAt, new Date(turn.at)) : ""}</span>
                    <span className="pill pill-cand" style={{ flex: "none" }}>{parallel ? agentNames.get(turn.agent) ?? turn.agent : turn.source === "panel" ? t("report.sourceChat") : t("report.sourceTerminal")}</span>
                    <span className="truncate" style={{ flex: 1 }}>{turn.prompt}</span>
                    {turn.steps > 1 && <span className="faint" style={{ flex: "none" }}>{t("report.steps", { n: turn.steps })}{turn.tools.length ? ` · ${turn.tools.slice(0, 3).join(", ")}` : ""}</span>}
                  </summary>
                  <div style={{ padding: "0 16px 14px 72px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: "var(--r)", whiteSpace: "pre-wrap", fontSize: 12.5 }}>{turn.prompt}</div>
                    {turn.response && <div className="muted" style={{ whiteSpace: "pre-wrap", fontSize: 12.5, padding: "2px 0 2px 12px", boxShadow: "inset 2px 0 0 var(--accent)" }}>{turn.response}</div>}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 72 }}>
          <div className="card" data-el="decision">
            <div className="card-head">{t("report.decision")}</div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 6 }}>
              <form action={decide.bind(null, id, "advance")}><button className={`btn btn-block ${session.decision === "advance" ? "btn-ok" : ""}`} data-el="decision-advance">{t("decision.advance")}</button></form>
              <form action={decide.bind(null, id, "talk")}><button className="btn btn-block" style={session.decision === "talk" ? { color: "var(--warn)", borderColor: "rgba(245,165,36,.4)", background: "var(--warn-soft)" } : undefined}>{t("decision.talk")}</button></form>
              <form action={decide.bind(null, id, "reject")}><button className="btn btn-block" style={session.decision === "reject" ? { background: "var(--surface-3)", color: "var(--text)" } : undefined} data-el="decision-reject">{t("report.pass")}</button></form>
            </div>
            <div className="card-foot faint" style={{ fontSize: 11.5, justifyContent: "center" }}>{t("report.decisionNoEmail")}</div>
          </div>

          <form action={saveEvaluation.bind(null, id)} className="card" data-el="rubric">
            <div className="card-head">{t("report.yourReview")}{mine && <span className="aside">{t("report.saved")}</span>}</div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {criteria.map((c) => <Rating key={c.key} name={c.key} label={t(c.labelKey)} initial={mine?.scores[c.key] ?? 0} />)}
              {traps.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div className="field-label" style={{ marginBottom: 6 }}>{t("report.trapsCaught")}</div>
                  {traps.map((trap) => (
                    <label key={trap} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, padding: "4px 0", cursor: "pointer" }} className="muted"><input type="checkbox" className="check-box" name="trap" value={trap} defaultChecked={mine?.trapsFound.includes(trap)} style={{ marginTop: 1 }} />{trap}</label>
                  ))}
                </div>
              )}
              <textarea className="input" name="comment" rows={3} defaultValue={mine?.comment ?? ""} placeholder={t("report.commentPlaceholder")} aria-label={t("report.comment")} />
            </div>
            <div className="card-foot"><button className="btn" style={{ marginLeft: "auto" }}>{t("report.saveReview")}</button></div>
          </form>

          {others.length > 0 && (
            <div className="card">
              <div className="card-head">{t("report.otherReviewers")}<span className="count">{others.length}</span></div>
              {others.map((e) => (
                <div key={e.id} className="list-item" style={{ alignItems: "flex-start", padding: "12px 16px" }}>
                  <span className="avatar">{initials(e.evaluator)}</span>
                  <div style={{ minWidth: 0, fontSize: 12 }}>
                    <div style={{ fontWeight: 500 }}>{displayName(e.evaluator)}</div>
                    <div className="muted" style={{ marginTop: 2 }}>{criteria.map((c) => `${t(c.labelKey)}: ${e.scores[c.key] || "–"}`).join(" · ")}</div>
                    {e.comment && <div className="muted" style={{ marginTop: 6 }}>{e.comment}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card" data-el="follow-up">
            <div className="card-head">{t("report.followUpQuestions")}</div>
            <div className="card-body">
              {session.defenseQuestions?.length ? (
                <ol style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5, lineHeight: 1.6, listStyle: "decimal", color: "var(--text-2)" }}>{session.defenseQuestions.map((q) => <li key={q}>{q}</li>)}</ol>
              ) : (
                <p className="faint" style={{ fontSize: 12, lineHeight: 1.55 }}>{env.anthropicKey ? t("report.questionsHint") : t("report.questionsNoKey")}</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
