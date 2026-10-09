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
import { displayName, elapsed, initials, money, when } from "@/lib/format";
import { modelLabel } from "@/lib/pricing";
import { env } from "@/lib/env";
import { PrepSummary } from "@/components/prep-summary";
import { decide, generateDefense, saveEvaluation } from "./actions";
import { setupView } from "@/lib/setup/store";
import { SetupSummary } from "@/components/setup/setup-summary";

export const metadata: Metadata = { title: "Session report" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
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
  const agentNames = new Map([["main", "Main"], ...extraAgents.map((a) => [a.key, a.name] as [string, string])]);
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
          agents: [{ key: "main", name: "Main", openedAt: session.startedAt.getTime(), closedAt: null }, ...extraAgents.map((a) => ({ key: a.key, name: a.name, openedAt: a.createdAt.getTime(), closedAt: a.closedAt?.getTime() ?? null }))],
          turns,
        })
      : null;
  const strip = minuteStrip(session.startedAt, session.endedAt, events, calls);
  const pastes = events.filter((e) => e.kind === "paste" || e.kind === "apply-ai");
  const used = session.startedAt && session.endedAt ? elapsed(session.startedAt, session.endedAt) : "—";
  const decisionLabel = { advance: ["pill-ok", "Advanced"], talk: ["pill-warn", "Follow up"], reject: ["", "Not advancing"] } as const;
  const sub = <span className="faint" style={{ fontWeight: 400 }}> / </span>;
  return (
    <>
      {grading && <AutoRefresh ms={3000} />}
      <PageHeader
        crumb="Sessions" crumbHref="/sessions"
        title={displayName(session.candidateEmail, session.candidateName)}
        extra={
          <>
            <span className="pill">{session.status === "expired" ? "Time ran out" : "Finished"} · {when(session.endedAt)}</span>
            <span className="pill" data-el="token-revoked" title="The session's AI pass was revoked when it ended"><IconLock size={10} />AI access revoked</span>
            {session.decision && <span className={`pill ${decisionLabel[session.decision][0]}`}>{decisionLabel[session.decision][1]}</span>}
          </>
        }
        actions={
          <>
            <Link href={`/sessions/new?from=${session.id}`} className="btn btn-ghost">Reuse setup</Link>
            {env.anthropicKey && <form action={generateDefense.bind(null, id)}><button className="btn btn-primary" data-el="follow-up-questions">{session.defenseQuestions?.length ? "Regenerate questions" : "Generate follow-up questions"}</button></form>}
          </>
        }
      />
      <div className="page" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 24, alignItems: "start",  }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          <div data-el="scoreboard" className="stats">
            {[
              ["Hidden tests", grading ? <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>Running…</span> : <>{hiddenPassed}{sub}<span className="faint">{hiddenTotal}</span></>, hiddenTotal ? `${Math.round((hiddenPassed / hiddenTotal) * 100)}% passing` : "No hidden tests"],
              ["Traps found", traps.length ? <>{found.size}{sub}<span className="faint">{traps.length}</span></> : "—", traps.length ? "from the rubric" : "None in the rubric"],
              ["Time used", <span className="num" key="t">{used}</span>, `of ${session.minutes + session.extraMinutes} min`],
              ["AI spend", <span key="s" className="num">{money(spent)}</span>, `${turns.length} request${turns.length === 1 ? "" : "s"} · ${modelLabel(session.model)}`],
            ].map(([label, value, foot], i) => (
              <div key={i}>
                <span className="label">{label}</span>
                <div className="stat-value" style={{ fontSize: 24, whiteSpace: "nowrap" }}>{value}</div>
                <div className="faint truncate" style={{ fontSize: 12, marginTop: 4 }} title={String(foot)}>{foot}</div>
              </div>
            ))}
          </div>

          <div className="card" data-el="challenge-results">
            <div className="card-head">Challenges<span className="count">{challenges.length}</span></div>
            {challenges.map((c, i) => {
              const a = attempts.find((x) => x.index === i);
              const ratio = a?.hiddenTotal ? (a.hiddenPassed ?? 0) / a.hiddenTotal : null;
              const p = pastes.filter((e) => a?.startedAt && e.createdAt >= a.startedAt && (!a.submittedAt || e.createdAt <= a.submittedAt)).length;
              return (
                <details key={c.id} style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
                  <summary style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer", listStyle: "none" }} className="hover:!bg-white/[.02]">
                    <span className="step-num">{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate" style={{ fontWeight: 500 }}>{c.title}</div>
                      <div className="faint truncate" style={{ fontSize: 12 }}>{a?.submittedAt ? `Submitted after ${elapsed(a.startedAt, a.submittedAt)}` : "Not submitted"} · {a?.hiddenTotal ? `${a.hiddenPassed}/${a.hiddenTotal} hidden tests` : "No hidden test results"} · {p} paste{p === 1 ? "" : "s"} from Claude</div>
                    </div>
                    {ratio !== null && <span className={`pill ${ratio >= 0.85 ? "pill-ok" : ratio >= 0.5 ? "pill-warn" : "pill-err"}`}>{ratio >= 0.85 ? "Strong" : ratio >= 0.5 ? "Check" : "Weak"}</span>}
                  </summary>
                  {a?.hiddenOutput && <pre className="mono scroll-thin" style={{ margin: "0 16px 16px", padding: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 11.5, maxHeight: 280, overflow: "auto", color: "var(--text-2)" }}>{a.hiddenOutput}</pre>}
                </details>
              );
            })}
          </div>

          <PrepSummary sessionId={session.id} />

          <div className="card" data-el="ai-usage">
            <div className="card-head">How they used Claude<span className="aside">{strip.length} min, one block per minute</span></div>
            <div className="card-body">
              <MinuteStrip strip={strip} />
              {pastes.length > 0 && <div className="notice notice-warn" style={{ marginTop: 16 }}><b style={{ color: "var(--warn)", fontWeight: 500 }}>Claude&apos;s code went straight into a file {pastes.length} time{pastes.length === 1 ? "" : "s"}</b>, by paste or the apply button. Worth asking what they checked before keeping it.</div>}
            </div>
          </div>

          <SetupSummary view={setup} />

          {parallel && <ParallelReport data={parallel} produced={produced} />}

          <div className="card">
            <div className="card-head">Requests to Claude<span className="count">{turns.length}</span>{parallel && <span className="aside">tagged by agent</span>}</div>
            <div className="scroll-thin" style={{ maxHeight: 520, overflowY: "auto" }}>
              {turns.length === 0 && <div className="list-item faint">They didn&apos;t use Claude.</div>}
              {turns.map((t, i) => (
                <details key={t.id} style={{ borderTop: i ? "1px solid var(--border)" : undefined }}>
                  <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", fontSize: 12.5, listStyle: "none" }} className="hover:!bg-white/[.02]">
                    <span className="num faint" style={{ width: 44, flex: "none" }}>{session.startedAt ? elapsed(session.startedAt, new Date(t.at)) : ""}</span>
                    <span className="pill pill-cand" style={{ flex: "none" }}>{parallel ? agentNames.get(t.agent) ?? t.agent : t.source === "panel" ? "Chat" : "Terminal"}</span>
                    <span className="truncate" style={{ flex: 1 }}>{t.prompt}</span>
                    {t.steps > 1 && <span className="faint" style={{ flex: "none" }}>{t.steps} steps{t.tools.length ? ` · ${t.tools.slice(0, 3).join(", ")}` : ""}</span>}
                  </summary>
                  <div style={{ padding: "0 16px 14px 72px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: "var(--r)", whiteSpace: "pre-wrap", fontSize: 12.5 }}>{t.prompt}</div>
                    {t.response && <div className="muted" style={{ whiteSpace: "pre-wrap", fontSize: 12.5, padding: "2px 0 2px 12px", boxShadow: "inset 2px 0 0 var(--accent)" }}>{t.response}</div>}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 72 }}>
          <div className="card" data-el="decision">
            <div className="card-head">Decision</div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 6 }}>
              <form action={decide.bind(null, id, "advance")}><button className={`btn btn-block ${session.decision === "advance" ? "btn-ok" : ""}`} data-el="decision-advance">Advance</button></form>
              <form action={decide.bind(null, id, "talk")}><button className="btn btn-block" style={session.decision === "talk" ? { color: "var(--warn)", borderColor: "rgba(245,165,36,.4)", background: "var(--warn-soft)" } : undefined}>Follow up</button></form>
              <form action={decide.bind(null, id, "reject")}><button className="btn btn-block" style={session.decision === "reject" ? { background: "var(--surface-3)", color: "var(--text)" } : undefined} data-el="decision-reject">Pass</button></form>
            </div>
            <div className="card-foot faint" style={{ fontSize: 11.5, justifyContent: "center" }}>Deciding doesn&apos;t email the candidate.</div>
          </div>

          <form action={saveEvaluation.bind(null, id)} className="card" data-el="rubric">
            <div className="card-head">Your review{mine && <span className="aside">saved</span>}</div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {criteria.map((c) => <Rating key={c.key} name={c.key} label={c.label} initial={mine?.scores[c.key] ?? 0} />)}
              {traps.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div className="field-label" style={{ marginBottom: 6 }}>Traps they caught</div>
                  {traps.map((t) => (
                    <label key={t} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, padding: "4px 0", cursor: "pointer" }} className="muted"><input type="checkbox" className="check-box" name="trap" value={t} defaultChecked={mine?.trapsFound.includes(t)} style={{ marginTop: 1 }} />{t}</label>
                  ))}
                </div>
              )}
              <textarea className="input" name="comment" rows={3} defaultValue={mine?.comment ?? ""} placeholder="What drove your score?" aria-label="Comment" />
            </div>
            <div className="card-foot"><button className="btn" style={{ marginLeft: "auto" }}>Save review</button></div>
          </form>

          {others.length > 0 && (
            <div className="card">
              <div className="card-head">Other reviewers<span className="count">{others.length}</span></div>
              {others.map((e) => (
                <div key={e.id} className="list-item" style={{ alignItems: "flex-start", padding: "12px 16px" }}>
                  <span className="avatar">{initials(e.evaluator)}</span>
                  <div style={{ minWidth: 0, fontSize: 12 }}>
                    <div style={{ fontWeight: 500 }}>{displayName(e.evaluator)}</div>
                    <div className="muted" style={{ marginTop: 2 }}>{criteria.map((c) => `${c.label}: ${e.scores[c.key] || "–"}`).join(" · ")}</div>
                    {e.comment && <div className="muted" style={{ marginTop: 6 }}>{e.comment}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card" data-el="follow-up">
            <div className="card-head">Follow-up questions</div>
            <div className="card-body">
              {session.defenseQuestions?.length ? (
                <ol style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5, lineHeight: 1.6, listStyle: "decimal", color: "var(--text-2)" }}>{session.defenseQuestions.map((q) => <li key={q}>{q}</li>)}</ol>
              ) : (
                <p className="faint" style={{ fontSize: 12, lineHeight: 1.55 }}>{env.anthropicKey ? "Generate them from the header. Claude reads the session log and suggests 3 questions tied to what actually happened." : "Set ANTHROPIC_API_KEY on the server to generate them."}</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
