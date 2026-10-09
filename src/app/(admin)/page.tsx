import type { Metadata } from "next";
import Link from "next/link";
import { desc, inArray, isNull } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { funnelCounts } from "@/components/funnel";
import { Empty } from "@/components/empty";
import { Person } from "@/components/person";
import { CodeCrystal, Sprout, Starfield, Stopwatch } from "@/components/brand";
import { IconArrow, IconChevron } from "@/components/icons";
import { Progress, Ticker } from "@/components/motion";
import { requireAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { monthSpend } from "@/lib/gateway";
import { modelLabel } from "@/lib/pricing";
import { clock, displayName, money, relativeDays, when } from "@/lib/format";
import { remainingMs } from "@/lib/sessions";
import { currentWatchers } from "@/lib/watchers";
import { QuickInvite, type QuickSetup } from "./quick-invite";

export const metadata: Metadata = { title: "Overview" };

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function Metric({ label, value, foot, tone, money: isMoney }: { label: string; value: number; foot: React.ReactNode; tone?: string; money?: boolean }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="metric-value" style={{ color: tone }}><Ticker value={value} format={isMoney ? "money" : "int"} /></div>
      <div className="metric-foot">{foot}</div>
    </div>
  );
}

export default async function OverviewPage() {
  const admin = await requireAdmin();
  const [sessions, evaluations, challenges, spent] = await Promise.all([
    db.query.sessions.findMany({ where: isNull(schema.sessions.practiceOf), orderBy: desc(schema.sessions.createdAt) }),
    db.query.evaluations.findMany(),
    db.query.challenges.findMany(),
    monthSpend(),
  ]);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const week = sessions.filter((s) => s.createdAt.getTime() > weekAgo);
  const live = sessions.filter((s) => s.status === "running");
  const paused = sessions.filter((s) => s.status === "paused");
  const toReview = sessions.filter((s) => (s.status === "submitted" || s.status === "expired") && !s.decision);
  const waitingMe = toReview.filter((s) => !evaluations.some((e) => e.sessionId === s.id && e.evaluator === admin.email));
  const waiting = sessions.filter((s) => s.status === "invited" && s.inviteExpiresAt.getTime() > Date.now()).sort((a, b) => a.inviteExpiresAt.getTime() - b.inviteExpiresAt.getTime());
  const watched = [...live, ...toReview].map((s) => s.id);
  const [calls, attempts] = watched.length
    ? await Promise.all([
        db.query.aiCalls.findMany({ where: inArray(schema.aiCalls.sessionId, watched), columns: { sessionId: true, prompt: true, createdAt: true }, orderBy: desc(schema.aiCalls.createdAt) }),
        db.query.attempts.findMany({ where: inArray(schema.attempts.sessionId, watched), columns: { sessionId: true, hiddenPassed: true, hiddenTotal: true } }),
      ])
    : [[], []];
  const pct = (spent / env.monthlyBudgetUsd) * 100;
  const published = challenges.filter((c) => c.status === "published");
  const title = (id: string) => challenges.find((c) => c.id === id)?.title ?? "Deleted challenge";
  const setName = (ids: string[]) => (ids.length ? `${title(ids[0])}${ids.length > 1 ? ` +${ids.length - 1}` : ""}` : "No challenges");
  const first = displayName(admin.email, admin.name).split(" ")[0];

  const sets = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = s.challengeIds.join(",");
    sets.set(key, [...(sets.get(key) ?? []), s]);
  }
  const setRows = [...sets.values()].slice(0, 6);
  const setups: QuickSetup[] = [...sets.values()]
    .map((list) => list[0])
    .filter((s) => s.challengeIds.every((id) => published.some((c) => c.id === id)))
    .slice(0, 8)
    .map((s) => ({ id: s.challengeIds.join(","), from: s.id, name: setName(s.challengeIds), detail: `${plural(s.challengeIds.length, "challenge", "challenges")} · ${s.minutes} min · ${modelLabel(s.model)} · ${money(s.budgetUsd)}`, challengeIds: s.challengeIds, minutes: s.minutes, budgetUsd: s.budgetUsd, model: s.model }));

  const next = waitingMe[0];
  const lines: React.ReactNode[] = [];
  if (waitingMe.length) lines.push(<><b>{plural(waitingMe.length, "session is", "sessions are")}</b> waiting for your review</>);
  if (live.length) lines.push(<><b>{plural(live.length, "candidate is", "candidates are")}</b> live right now</>);
  if (paused.length) lines.push(<><b>{paused.length} disconnected</b> with the clock paused</>);

  return (
    <>
      <PageHeader title="Overview" sub={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} />
      <div className="shell shell-body">
        <section className="hero" data-el="hero">
          <Starfield stars={90} aurora shooting />
          <div style={{ position: "relative" }}>
            <h2 className="display hero-greeting">Hi, {first}</h2>
            <p className="hero-line">
              {lines.length ? lines.map((l, i) => <span key={i}>{i ? (i === lines.length - 1 ? " and " : ", ") : ""}{l}</span>) : !published.length ? "Upload your first challenge, then invite someone to take it." : !sessions.length ? "Your challenges are ready. Invite your first candidate." : "Nothing needs you right now."}
              {lines.length ? "." : ""}
            </p>
            <div className="hero-actions">
              {next ? (
                <>
                  <Link href={`/sessions/${next.id}/report`} className="btn btn-primary btn-lg" data-el="review-next">Review {displayName(next.candidateEmail, next.candidateName).split(" ")[0]}</Link>
                  <Link href="/sessions/new" className="btn btn-lg">Invite <span className="kbd">C</span></Link>
                </>
              ) : !published.length ? (
                <Link href="/challenges/new" className="btn btn-primary btn-lg">Upload a challenge</Link>
              ) : (
                <Link href="/sessions/new" className="btn btn-primary btn-lg" data-el="invite">Invite a candidate <span className="kbd">C</span></Link>
              )}
            </div>
          </div>
          <div data-el="hero-art" style={{ position: "relative", width: 240, height: 200, display: "grid", placeItems: "center" }}>
            <span style={{ position: "absolute", left: 0, top: 18 }}><CodeCrystal glyph="angle" hue="mint" tilt={-12} size={52} delay={0.35} /></span>
            <span style={{ position: "absolute", right: 4, bottom: 10 }}><CodeCrystal glyph="brackets" hue="pink" tilt={10} size={44} delay={0.5} /></span>
            <Sprout mood={waitingMe.length ? "waving" : live.length ? "thinking" : "celebrating"} size={176} />
          </div>
        </section>

        <div className="metrics stagger" data-el="numbers">
          <div style={{ ["--i" as string]: 0 }}><Metric label="Invited this week" value={week.length} foot={`${week.filter((s) => s.status === "invited").length} not started yet`} /></div>
          <div style={{ ["--i" as string]: 1 }}><Metric label="Live now" value={live.length} foot={`${live.filter((s) => currentWatchers(s.id).length).length} with an interviewer`} /></div>
          <div style={{ ["--i" as string]: 2 }}><Metric label="To review" value={toReview.length} tone={toReview.length ? "var(--accent-text)" : undefined} foot={`${waitingMe.length} waiting on you`} /></div>
          <div style={{ ["--i" as string]: 3 }}><Metric label="AI this month" value={spent} money foot={<span style={{ color: pct > 80 ? "var(--warn)" : undefined }}>{Math.round(pct)}% of ${env.monthlyBudgetUsd} cap</span>} /></div>
        </div>

        <section className="section" data-el="live-now">
          <div className="section-head">
            <h2 className="section-title">Live now</h2>
            {live.length > 0 && <span className="section-sub num">{live.length}</span>}
            <span className="aside"><Link href="/sessions?filter=live" className="link-quiet" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>All live sessions<IconArrow size={13} /></Link></span>
          </div>
          {live.length === 0 ? (
            <div className="queue"><Empty title="No one is live" text="Sessions show up here the moment a candidate presses Start, with their progress and what they're asking Claude." /></div>
          ) : (
            <div className="live-grid stagger">
              {live.map((s, i) => {
                const watching = currentWatchers(s.id);
                const mine = calls.filter((c) => c.sessionId === s.id);
                const left = remainingMs(s);
                const total = (s.minutes + s.extraMinutes) * 60_000;
                return (
                  <Link key={s.id} href={`/sessions/${s.id}`} className="live-card" style={{ ["--i" as string]: i }} data-el="live-card">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}><Person email={s.candidateEmail} name={s.candidateName} sub={s.mode === "live" ? "Live interview" : "Take-home"} avatar /></div>
                      <span className="pill pill-err"><span className="dot dot-live" style={{ width: 5, height: 5 }} />Live</span>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                        <span className="truncate muted" style={{ fontSize: 13 }}>{s.currentIndex + 1}/{s.challengeIds.length} · {title(s.challengeIds[s.currentIndex] ?? "")}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Stopwatch progress={total ? left / total : 0} running urgent={left < 5 * 60_000} size={28} />
                          <span className="num" style={{ color: "var(--text)", fontWeight: 600, fontSize: 15 }}>{clock(left)}</span>
                        </span>
                      </div>
                      <div style={{ marginTop: 8 }}><Progress value={total ? ((total - left) / total) * 100 : 0} /></div>
                    </div>
                    <div className="agent-line">
                      <span className="thinking" aria-hidden="true"><i /><i /><i /></span>
                      <span className="truncate" style={{ flex: 1, color: "var(--text-2)" }}>{mine[0]?.prompt ?? "Hasn't asked Claude anything yet"}</span>
                      <span className="faint num" style={{ fontSize: 12 }}>{mine.length}</span>
                    </div>
                    <div className="faint" style={{ fontSize: 12.5 }}>{watching.length ? `${watching.map((w) => displayName(w).split(" ")[0]).join(", ")} watching` : "No one watching"}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="section" data-el="review-queue">
          <div className="section-head">
            <h2 className="section-title">Review queue</h2>
            {waitingMe.length + paused.length > 0 && <span className="section-sub num">{waitingMe.length + paused.length}</span>}
            <span className="aside"><Link href="/sessions?filter=review" className="link-quiet" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>All to review<IconArrow size={13} /></Link></span>
          </div>
          <div className="queue stagger">
            {waitingMe.length + paused.length === 0 && <Empty title="All caught up" text="When a candidate finishes, their session lands here for your review." art={<Sprout mood="celebrating" size={112} />} />}
            {waitingMe.map((s, i) => {
              const a = attempts.filter((x) => x.sessionId === s.id);
              const passed = a.reduce((n, x) => n + (x.hiddenPassed ?? 0), 0);
              const total = a.reduce((n, x) => n + (x.hiddenTotal ?? 0), 0);
              const ratio = total ? passed / total : null;
              const others = evaluations.filter((e) => e.sessionId === s.id && e.evaluator !== admin.email);
              return (
                <Link key={s.id} href={`/sessions/${s.id}/report`} className="queue-row" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1.3fr) 110px 150px 88px", ["--i" as string]: i }} data-el="pending-review">
                  <Person email={s.candidateEmail} name={s.candidateName} sub={others.length ? `${displayName(others[0].evaluator).split(" ")[0]} already reviewed` : s.candidateEmail} avatar />
                  <span className="truncate muted">{setName(s.challengeIds)}</span>
                  <span>{ratio === null ? <span className="faint">No tests</span> : <span className={`pill ${ratio >= 0.85 ? "pill-ok" : ratio >= 0.5 ? "pill-warn" : "pill-err"}`}>{passed}/{total} tests</span>}</span>
                  <span className="faint" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{s.status === "expired" ? "Time ran out" : "Finished"} {when(s.endedAt)}</span>
                  <span style={{ textAlign: "right" }}><span className="btn btn-sm">Review</span></span>
                </Link>
              );
            })}
            {paused.map((s, i) => (
              <Link key={s.id} href={`/sessions/${s.id}`} className="queue-row" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1.3fr) 110px 150px 88px", ["--i" as string]: waitingMe.length + i }} data-el="pending-dropped">
                <Person email={s.candidateEmail} name={s.candidateName} sub={s.candidateEmail} avatar />
                <span className="truncate muted">{setName(s.challengeIds)}</span>
                <span><span className="pill pill-warn">Disconnected</span></span>
                <span className="faint" style={{ fontSize: 13 }}>{s.startedAt && s.pausedAt ? `at ${Math.round((s.pausedAt.getTime() - s.startedAt.getTime() - s.pausedMs) / 60_000)} min, clock paused` : "clock paused"}</span>
                <span style={{ textAlign: "right" }}><span className="btn btn-sm">Open</span></span>
              </Link>
            ))}
          </div>
        </section>

        {waiting.length > 0 && (
          <section className="section" data-el="invited-waiting">
            <div className="section-head">
              <h2 className="section-title">Invited, not started</h2>
              <span className="section-sub num">{waiting.length}</span>
              <span className="aside"><Link href="/sessions?filter=waiting" className="link-quiet" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>All invites<IconArrow size={13} /></Link></span>
            </div>
            <div className="queue stagger">
              {waiting.slice(0, 6).map((s, i) => {
                const soon = s.inviteExpiresAt.getTime() - Date.now() < 86_400_000;
                return (
                  <Link key={s.id} href={`/sessions/${s.id}`} className="queue-row" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1.3fr) 110px 150px 88px", ["--i" as string]: i }} data-el="invited-row">
                    <Person email={s.candidateEmail} name={s.candidateName} sub={s.candidateEmail} avatar />
                    <span className="truncate muted">{setName(s.challengeIds)}</span>
                    <span><span className="pill">{s.mode === "live" ? "Live" : "Take-home"}</span></span>
                    <span style={{ fontSize: 13, color: soon ? "var(--warn)" : "var(--text-3)" }}>Expires {relativeDays(s.inviteExpiresAt)}</span>
                    <span style={{ textAlign: "right" }}><span className="btn btn-ghost btn-sm">View</span></span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="section" data-el="challenge-sets">
          <div className="section-head">
            <h2 className="section-title">By challenge set</h2>
            <span className="aside"><Link href="/sessions" className="link-quiet" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>All sessions<IconArrow size={13} /></Link></span>
          </div>
          <div className="data-table">
            {setRows.length === 0 ? (
              <Empty title="No invites yet" text="Each set of challenges you invite people to gets a row here, with how far candidates got." action={<Link href="/sessions/new" className="btn btn-primary">Invite a candidate</Link>} />
            ) : (
              <>
                <div className="row-head" style={{ gridTemplateColumns: "minmax(0,1fr) repeat(4, 88px) 120px", gap: 12 }}>
                  <span>Challenges</span><span style={{ textAlign: "right" }}>Invited</span><span style={{ textAlign: "right" }}>Done</span><span style={{ textAlign: "right" }}>Reviewed</span><span style={{ textAlign: "right" }}>Advanced</span><span />
                </div>
                {setRows.map((list) => {
                  const c = funnelCounts(list);
                  const ids = list[0].challengeIds;
                  return (
                    <div key={ids.join(",")} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) repeat(4, 88px) 120px", gap: 12 }} data-el="set-row">
                      <div style={{ minWidth: 0 }}>
                        <div className="truncate" style={{ fontWeight: 600, color: "var(--text)" }}>
                        {ids.map((id, i) => <span key={id}>{i > 0 && <span className="faint" style={{ display: "inline-flex", verticalAlign: "-2px", margin: "0 6px" }}><IconChevron size={13} /></span>}{title(id)}</span>)}
                      </div>
                        <div className="faint truncate" style={{ fontSize: 12.5 }}>{plural(ids.length, "challenge", "challenges")} · last invite {when(list[0].createdAt)}</div>
                      </div>
                      {[c.invited, c.did, c.evaluated, c.advanced].map((n, i) => (
                        <span key={i} className="num" style={{ textAlign: "right", fontSize: 15, color: i === 3 && n ? "var(--ok)" : n ? "var(--text)" : "var(--text-3)" }}>{n}</span>
                      ))}
                      <div style={{ textAlign: "right" }}><Link href={`/sessions/new?from=${list[0].id}`} className="btn btn-sm" data-el="invite-again">Invite more</Link></div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </section>

        <section className="section">
          <div className="section-head"><h2 className="section-title">Quick invite</h2><span className="section-sub">reuse a recent setup</span></div>
          <QuickInvite setups={setups} />
        </section>
      </div>
    </>
  );
}
