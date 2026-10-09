"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { IconAlert, IconCheck, IconCopy } from "@/components/icons";
import { Select } from "@/components/select";
import { Segmented } from "@/components/segmented";
import { DateTimePicker } from "@/components/date-time-picker";
import { inviteMany, type InviteResult } from "../actions";

export type InviteChallenge = { id: string; title: string; level: string; levelLabel: string; kind: "code" | "screen"; minutes: number; runtime: string };
export type InviteSetup = { challengeIds: string[]; minutes: number; budgetUsd: number; model: string; mode: "live" | "async" };

type Props = {
  challenges: InviteChallenge[];
  models: { id: string; label: string }[];
  taken: { email: string; key: string }[];
  mailOn: boolean;
  initial?: InviteSetup;
  box?: { cpus: number; memoryMb: number };
  prepDays?: number;
};

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function useReview(text: string, taken: Props["taken"], key: string) {
  return useMemo(() => {
    const seen = new Set<string>();
    return text
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .map((email) => {
        if (seen.has(email)) return { email, state: "dup" as const };
        seen.add(email);
        if (!emailRe.test(email)) return { email, state: "invalid" as const };
        if (key && taken.some((t) => t.email === email && t.key === key)) return { email, state: "taken" as const };
        return { email, state: "ok" as const };
      });
  }, [text, taken, key]);
}

function Done({ links, mailOn }: { links: { email: string; url: string; mailed: boolean }[]; mailOn: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(url: string) {
    void navigator.clipboard.writeText(url);
    setCopied(url);
  }
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--ok-soft)", color: "var(--ok)" }}><IconCheck size={18} /></span>
        <div>
          <h2 className="hero-title" style={{ fontSize: 24 }}>{links.length === 1 ? "Invite created" : `${links.length} invites created`}</h2>
          <p className="muted">{mailOn ? "The emails are on their way." : "Email isn't configured, so copy each link and send it yourself."} Each link works once.</p>
        </div>
      </div>
      <div className="card" style={{ marginTop: 24 }}>
        {links.map((l) => (
          <div key={l.url} className="list-item" style={{ minHeight: 60 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>{l.email}{l.mailed && <span className="pill pill-ok">Email sent</span>}</div>
              <div className="mono faint truncate" style={{ fontSize: 11.5, marginTop: 2 }} data-testid="invite-link">{l.url}</div>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => copy(l.url)}>{copied === l.url ? <><IconCheck size={12} />Copied</> : <><IconCopy size={13} />Copy link</>}</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <a className="btn" href="/sessions/new">Invite more</a>
        <Link className="btn btn-ghost" href="/sessions">Go to sessions</Link>
      </div>
    </div>
  );
}

function Review({ review }: { review: ReturnType<typeof useReview> }) {
  const ok = review.filter((r) => r.state === "ok").length;
  const check = review.filter((r) => r.state === "invalid" || r.state === "taken");
  const dups = review.filter((r) => r.state === "dup").length;
  return (
    <div data-el="email-review" style={{ marginTop: 10, border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", gap: 16, fontSize: 12, background: "var(--bg-raised)" }}>
        <span className="muted"><b className="num" style={{ color: "var(--ok)", fontWeight: 500 }}>{ok}</b> ready</span>
        {check.length > 0 && <span className="muted"><b className="num" style={{ color: "var(--warn)", fontWeight: 500 }}>{check.length}</b> skipped</span>}
        {dups > 0 && <span className="faint">{dups} duplicate{dups === 1 ? "" : "s"} ignored</span>}
      </div>
      <div className="scroll-thin" style={{ maxHeight: 180, overflowY: "auto" }}>
        {review.filter((r) => r.state !== "dup").map((r) => (
          <div key={r.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", fontSize: 12 }}>
            <span style={{ color: r.state === "ok" ? "var(--ok)" : "var(--warn)", display: "flex" }}>{r.state === "ok" ? <IconCheck size={12} /> : <IconAlert size={13} />}</span>
            <span className="mono truncate" style={{ flex: 1 }}>{r.email}</span>
            {r.state === "invalid" && <span style={{ color: "var(--warn)", whiteSpace: "nowrap" }}>Not a valid email</span>}
            {r.state === "taken" && <span style={{ color: "var(--warn)", whiteSpace: "nowrap" }}>Already invited to these challenges</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ title, text, children, el }: { title: string; text?: React.ReactNode; children: React.ReactNode; el?: string }) {
  return (
    <div className="form-row" data-el={el}>
      <div className="form-row-label"><b>{title}</b>{text && <span>{text}</span>}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function Arrow({ up }: { up?: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={up ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} /></svg>;
}

function Cross() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}

const levelInk: Record<string, string> = { junior: "var(--ok)", pleno: "var(--accent-text)", senior: "var(--warn)" };

function ChallengePicker({ all, picked, setPicked }: { all: InviteChallenge[]; picked: string[]; setPicked: (ids: string[]) => void }) {
  const rest = all.filter((c) => !picked.includes(c.id));
  const move = (i: number, by: number) => {
    const next = [...picked];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setPicked(next);
  };
  if (!all.length) {
    return <div className="notice notice-warn">No published challenges yet. <Link href="/challenges/new" style={{ textDecoration: "underline", color: "var(--text)" }}>Upload one</Link> and publish it first.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {picked.length > 0 && (
        <ol data-el="picked-challenges" style={{ border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden" }}>
          {picked.map((id, i) => {
            const c = all.find((x) => x.id === id);
            if (!c) return null;
            return (
              <li key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px 8px 12px", borderTop: i ? "1px solid var(--border)" : undefined, background: "var(--bg-raised)" }}>
                <input type="hidden" name="challenge" value={id} />
                <span className="step-num">{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="truncate" style={{ fontWeight: 500 }}>{c.title}</div>
                  <div className="faint truncate" style={{ fontSize: 11.5 }}><span style={{ color: levelInk[c.level] }}>{c.levelLabel}</span> · {c.kind === "screen" ? "UI" : "Code"} · {c.runtime} · {c.minutes} min</div>
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Move ${c.title} up`} disabled={i === 0} onClick={() => move(i, -1)}><Arrow up /></button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Move ${c.title} down`} disabled={i === picked.length - 1} onClick={() => move(i, 1)}><Arrow /></button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Remove ${c.title}`} onClick={() => setPicked(picked.filter((x) => x !== id))}><Cross /></button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {rest.length > 0 && (
        <Select
          key={picked.join(",")}
          ariaLabel="Add a challenge"
          placeholder={picked.length ? "Add another challenge…" : "Choose a challenge…"}
          value=""
          onChange={(id) => setPicked([...picked, id])}
          options={rest.map((c) => ({ value: c.id, label: c.title, text: c.title, hint: `${c.levelLabel} · ${c.minutes} min` }))}
        />
      )}
    </div>
  );
}

export function InviteForm({ challenges, models, taken, mailOn, initial, box, prepDays = 7 }: Props) {
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(inviteMany, null);
  const [picked, setPicked] = useState<string[]>(initial?.challengeIds.filter((id) => challenges.some((c) => c.id === id)) ?? []);
  const [mode, setMode] = useState<"live" | "async">(initial?.mode ?? "live");
  const [text, setText] = useState("");
  const [minutesInput, setMinutesInput] = useState<string | null>(initial ? String(initial.minutes) : null);
  const [budget, setBudget] = useState(String(initial?.budgetUsd ?? 5));
  const [scheduled, setScheduled] = useState<Date | null>(null);
  const [limits] = useState(() => ({ min: new Date(), max: new Date(Date.now() + 120 * 86_400_000) }));
  const scheduledIso = scheduled ? scheduled.toISOString() : "";
  const [model, setModel] = useState(initial?.model && models.some((m) => m.id === initial.model) ? initial.model : models[0].id);
  const key = picked.join(",");
  const review = useReview(text, taken, key);
  const ready = review.filter((r) => r.state === "ok").length;
  const suggested = picked.reduce((sum, id) => sum + (challenges.find((c) => c.id === id)?.minutes ?? 0), 0);
  const minutes = minutesInput ?? String(suggested || 60);
  const days = mode === "async" ? 5 : 2;
  const expires = new Date(Math.max(Date.now() + days * 86_400_000, scheduledIso ? new Date(scheduledIso).getTime() + 86_400_000 : 0)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const budgetNum = Number(budget) || 0;
  const modelLabel = models.find((m) => m.id === model)?.label ?? model;
  const canSend = !pending && ready > 0 && picked.length > 0;

  if (state?.ok) return <Done links={state.links} mailOn={mailOn} />;

  return (
    <form action={action} className="page" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 24, alignItems: "start",  }}>
      <input type="hidden" name="mode" value={mode} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <section className="card">
          <div className="card-head">Who</div>
          <Row title="Candidates" text="One email or many. Separate with new lines, commas or spaces." el="emails">
            <textarea className="input mono" name="emails" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={"ada@example.com\ngrace@example.com"} data-el="emails-field" aria-label="Candidate emails" style={{ fontSize: 12.5 }} />
            {review.length > 0 && <Review review={review} />}
          </Row>
        </section>
        <section className="card">
          <div className="card-head">What<span className="aside">{picked.length > 0 && <span className="num">{picked.length} challenge{picked.length === 1 ? "" : "s"} · {suggested} min suggested</span>}</span></div>
          <Row title="Challenges" text="Shown one at a time, in this order. The next one unlocks when the candidate submits." el="challenges">
            <ChallengePicker all={challenges} picked={picked} setPicked={setPicked} />
          </Row>
          <Row title="Format" text={mode === "live" ? "You're on a call together and can watch live from here." : "They do it on their own schedule. You can watch or replay anytime."} el="invite-mode">
            <Segmented ariaLabel="Format" value={mode} onChange={setMode} options={[{ value: "live", label: "Live with us" }, { value: "async", label: "Take-home" }]} />
          </Row>
          <Row title="Interview date" text={<>Optional. Candidates see a countdown, and the prep kit opens {prepDays} day{prepDays === 1 ? "" : "s"} before. <Link href="/settings/prep" style={{ textDecoration: "underline" }}>Edit the kit</Link></>} el="interview-date">
            <DateTimePicker name="scheduledAt" value={scheduled} onChange={setScheduled} min={limits.min} max={limits.max} ariaLabel="Interview date and time" placeholder="Not scheduled" />
          </Row>
          <Row title="Time limit" text="Total for the whole session. The clock starts when they press Start.">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label className="input input-group" style={{ width: 140 }}>
                <input name="minutes" type="number" inputMode="numeric" min={10} max={600} value={minutes} onChange={(e) => setMinutesInput(e.target.value)} aria-label="Time limit in minutes" className="num" />
                <span className="addon">min</span>
              </label>
              {minutesInput !== null && suggested > 0 && Number(minutesInput) !== suggested && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMinutesInput(null)}>Use suggested ({suggested} min)</button>
              )}
            </div>
          </Row>
        </section>
        <section className="card">
          <div className="card-head">AI access<span className="aside">billed to your Anthropic key</span></div>
          <Row title="Model" text="What Claude runs as in the candidate's terminal and chat.">
            <div style={{ maxWidth: 280 }}>
              <Select name="model" value={model} onChange={setModel} ariaLabel="Model" options={models.map((m) => ({ value: m.id, label: m.label, text: m.label }))} />
            </div>
          </Row>
          <Row title="Budget per person" text="When a candidate hits it, AI stops for them. Everything else keeps working.">
            <label className="input input-group" style={{ width: 160 }}>
              <span className="addon">$</span>
              <input name="budget" type="number" inputMode="decimal" step="0.5" min={0.5} max={100} value={budget} onChange={(e) => setBudget(e.target.value)} aria-label="AI budget per person in US dollars" className="num" />
              <span className="addon">USD</span>
            </label>
          </Row>
        </section>
        {state && !state.ok && <div className="notice notice-err" role="alert">{state.error}</div>}
      </div>

      <aside style={{ position: "sticky", top: 72, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card">
          <div className="card-head">Summary</div>
          <dl style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "10px 16px", fontSize: 12.5 }}>
            {[
              ["Candidates", ready ? String(ready) : "—"],
              ["Challenges", picked.length ? String(picked.length) : "—"],
              ["Format", mode === "live" ? "Live" : "Take-home"],
              ["Interview", scheduledIso ? new Date(scheduledIso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "When they're ready"],
              ["Time limit", `${minutes || "—"} min`],
              ["Model", modelLabel],
              ["AI budget", `$${budgetNum.toFixed(2)} each`],
              ["Link expires", expires],
              ["Sandbox", box ? `${box.cpus} vCPU · ${box.memoryMb >= 1024 ? `${+(box.memoryMb / 1024).toFixed(1)} GB` : `${box.memoryMb} MB`}` : "Isolated"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt className="muted">{k}</dt>
                <dd className="truncate" style={{ textAlign: "right" }}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="card-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            {ready > 1 && <div className="faint" style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}><span>Max AI spend</span><span className="num" style={{ color: "var(--text-2)" }}>${(ready * budgetNum).toFixed(2)}</span></div>}
            <button className="btn btn-primary btn-lg btn-block" disabled={!canSend} data-el="send-invites">
              {pending ? "Sending…" : ready > 1 ? `Send ${ready} invites` : "Send invite"}
            </button>
            <div className="faint" style={{ fontSize: 11.5, textAlign: "center" }}>{!picked.length ? "Pick at least one challenge." : !ready ? "Add at least one email." : mailOn ? "Each person gets a one-time link by email." : "Email isn't configured: you'll get the links to copy."}</div>
          </div>
        </div>
        <div className="notice notice-quiet" style={{ fontSize: 12 }}>
          The API key never enters the sandbox. Each session gets a pass that only works for it and dies with it.
        </div>
      </aside>
    </form>
  );
}
