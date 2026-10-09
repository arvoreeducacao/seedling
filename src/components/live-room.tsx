"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowsInLineHorizontal, ArrowsOutLineHorizontal, Browser, ChatCircleText, Clock, GitDiff, Crosshair, Eye, FileCode, Flask, ListBullets, NotePencil, PaperPlaneTilt, Plus, Power, Sparkle, StopCircle, Target, X } from "@phosphor-icons/react";
import { addNote, addTime, cutAi, endSession, messageCandidate } from "@/app/(admin)/sessions/actions";
import { TerminalView, type TerminalStatus } from "@/components/workspace/terminal";
import { ChangesPanel, Empty, useChanges } from "@/components/workspace/panels";
import { FilesView, useFileTabs, type Doc } from "@/components/workspace/files";
import { BrowserPane } from "@/components/workspace/browser";
import { parseAddress } from "@/components/workspace/address";
import { kindOf } from "@/components/workspace/file-kinds";
import { terminalFont } from "@/components/workspace/fonts";
import ui from "@/components/workspace/ui.module.css";
import { groupTurns, type RecordedCall, type Turn } from "@/lib/calls";
import { clock } from "@/lib/format";
import { Markdown } from "@/components/workspace/markdown";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Keys, Shimmer, TabIndicator, Thinking, ToolChip, spring } from "@/components/workspace/ai";
import { AgentBuddy, Sprout } from "@/components/brand";
import { SetupChip } from "@/components/setup/setup-chip";
import type { SetupView } from "@/lib/setup/store";

type Live = {
  status: string;
  remainingMs: number;
  currentIndex: number;
  total: number;
  challenge: { title: string; kind: string; traps: string[] } | null;
  candidate: string;
  files: { path: string; dir: boolean; size?: number; mtime?: number }[];
  focus: string | null;
  spent: number;
  budget: number;
  aiActive: boolean;
  tests: { passed?: number; total?: number } | null;
  calls: { id: string; at: string; source: string; prompt: string | null; response: string | null; tools: string[]; cost: number; status: number; agent?: string }[];
  agents?: LiveAgent[];
  events: { id: string; at: string; kind: string; actor: string; data: Record<string, unknown> }[];
  startedAt: string | null;
};

type LiveAgent = { key: string; name: string; status: "working" | "waiting" | "idle" | "closed"; lastPrompt: string | null; lastPromptAt: string | null; prompts: number; cost: number; closedAt: string | null; mergedAt: string | null };

const statusLabel: Record<LiveAgent["status"], string> = { working: "Working", waiting: "Waiting", idle: "Idle", closed: "Closed" };
const statusHint: Record<LiveAgent["status"], string> = { working: "Calling Claude or running tools right now", waiting: "Finished its turn and is waiting on the candidate", idle: "Not prompted yet", closed: "Closed by the candidate" };
const statusDot: Record<LiveAgent["status"], string> = { working: "working", waiting: "done", idle: "idle", closed: "idle" };

type Side = "prompts" | "timeline" | "code" | "changes" | "browser";

function since(start: string | null, at: string) {
  if (!start) return "";
  return clock(new Date(at).getTime() - new Date(start).getTime());
}

const eventText: Record<string, (d: Record<string, unknown>) => string> = {
  start: (d) => (d.restarted ? "sandbox restarted after a deploy, files kept" : "started the session"),
  "file-open": (d) => `opened ${d.path}`,
  "file-save": (d) => `saved ${d.path}${d.created ? " (new)" : ""}`,
  paste: (d) => `pasted ${d.chars} characters into ${d.path}`,
  "apply-ai": (d) => `applied AI code to ${d.path}`,
  "test-run": (d) => `ran tests: ${d.passed}/${d.total}`,
  submit: (d) => `submitted challenge ${Number(d.index) + 1}`,
  note: (d) => `note: ${d.text}`,
  extend: (d) => `added ${d.minutes} min`,
  revoke: (d) => `AI turned off: ${d.reason}`,
  message: (d) => `message to candidate: ${d.text}`,
  "agent-open": (d) => `opened a new agent: ${d.name}`,
  "agent-rename": (d) => `renamed an agent to ${d.name}`,
  "agent-merge": (d) => `merged ${d.name} into the workspace (${(d.files as string[] | undefined)?.length ?? 0} files, +${d.added ?? 0} −${d.removed ?? 0})`,
  "agent-close": (d) => `closed ${d.name}${d.merged ? "" : (d.files as string[] | undefined)?.length ? ` without merging ${(d.files as string[]).length} changed files` : ""}`,
  browse: (d) => `opened ${d.address} in the browser`,
};

const toneFor: Record<string, string> = { paste: "var(--w-warn)", "apply-ai": "var(--w-warn)", submit: "var(--w-ok)", note: "var(--w-intv)", revoke: "var(--w-err)", message: "var(--w-intv)", "test-run": "var(--w-cand)" };

export function LiveRoom({ sessionId, setup }: { sessionId: string; setup?: SetupView }) {
  const router = useRouter();
  const [live, setLive] = useState<Live | null>(null);
  const [left, setLeft] = useState(0);
  const [side, setSide] = useState<Side>("prompts");
  const [follow, setFollow] = useState(true);
  const [focusAgent, setFocusAgent] = useState("main");
  const [changesAgent, setChangesAgent] = useState("main");
  const [browserVisited, setBrowserVisited] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [status, setStatus] = useState<TerminalStatus>("connecting");
  const [showInternal, setShowInternal] = useState(false);
  const followed = useRef<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const callCount = live?.calls.length ?? 0;

  useEffect(() => {
    const el = feedRef.current;
    if (!el || side !== "prompts") return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 280) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [callCount, side]);
  const changes = useChanges(`/api/admin/sessions/${sessionId}/changes?i=${live?.currentIndex ?? 0}&agent=${changesAgent}`, side === "changes");
  const index = live?.currentIndex ?? 0;
  const fileSource = useMemo(
    () => ({
      async read(path: string): Promise<Doc> {
        const res = await fetch(`/api/admin/sessions/${sessionId}/file?index=${index}&path=${encodeURIComponent(path)}`, { cache: "no-store" });
        if (res.status === 404) return { content: null, missing: true };
        if (!res.ok) throw new Error("could not read");
        return res.json();
      },
      rawUrl(path: string, version?: number, download?: boolean) {
        return `/api/admin/sessions/${sessionId}/raw?index=${index}&path=${encodeURIComponent(path)}${version ? `&v=${version}` : ""}${download ? "&download=1" : ""}`;
      },
    }),
    [sessionId, index],
  );
  const fileTabs = useFileTabs(fileSource);
  const openTab = fileTabs.open;
  const resetTabs = fileTabs.reset;

  useEffect(() => {
    resetTabs();
    followed.current = null;
  }, [index, resetTabs]);

  useEffect(() => {
    const focus = live?.focus;
    if (!follow || !focus || focus === followed.current) return;
    followed.current = focus;
    openTab(focus);
  }, [follow, live?.focus, openTab]);

  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/sessions/${sessionId}/live`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const json: Live = await res.json();
    if (json.status !== "running") {
      router.replace(`/sessions/${sessionId}/report`);
      return;
    }
    setLive(json);
    setLeft(json.remainingMs);
  }, [sessionId, router]);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setFailure(null);
    try {
      await action();
      await load();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setFailure(/server action|failed to fetch|network/i.test(message) ? `Couldn't ${label}: the app was just updated or the connection dropped. Reload the page and try again.` : `Couldn't ${label}. ${message || "Try again."}`);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function submitForm(e: React.FormEvent<HTMLFormElement>, label: string, action: (fd: FormData) => Promise<unknown>, after?: () => void) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (![...fd.values()].some((v) => String(v).trim())) return;
    if (await run(label, () => action(fd))) {
      form.reset();
      after?.();
    }
  }

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 2500);
    const tick = setInterval(() => setLeft((ms) => Math.max(0, ms - 1000)), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  if (!live) {
    return (
      <div className={`${ui.root} ${ui.loading}`}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <Sprout mood="thinking" size={104} />
          <Shimmer>Connecting to the session</Shimmer>
        </div>
      </div>
    );
  }

  const who = live.candidate.split(" ")[0];
  const pasted = live.events.filter((e) => e.kind === "paste" || e.kind === "apply-ai").length;
  const low = left < 300_000;
  const spentPct = live.budget ? Math.min(100, (live.spent / live.budget) * 100) : 0;
  const { turns, internal } = groupTurns(live.calls);
  const agents = live.agents ?? [];
  const agentNames = new Map(agents.map((a) => [a.key, a.name]));
  const multi = agents.length > 1;
  const focused = agents.find((a) => a.key === focusAgent) ?? agents[0];
  const openAgents = agents.filter((a) => a.status !== "closed");
  const lastCallAt = live.calls.length ? Math.max(...live.calls.map((c) => new Date(c.at).getTime())) : 0;
  const agentBusy = live.aiActive && lastCallAt > 0 && Date.now() - lastCallAt < 20_000;
  const internalCost = internal.reduce((n, c) => n + c.cost, 0);
  const timeline = [
    ...live.events.filter((e) => e.kind !== "file-save" || Math.abs(Number(e.data.delta ?? 0)) > 200).map((e) => ({ at: e.at, node: <EventRow key={e.id} e={e} start={live.startedAt} /> })),
    ...turns.map((t) => ({ at: t.at, node: <PromptRow key={t.id} t={t} start={live.startedAt} who={who} agentName={multi ? agentNames.get(t.agent) : undefined} compact /> })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const sides: { id: Side; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "prompts", label: "Prompts", icon: <ChatCircleText size={14} />, count: turns.length },
    { id: "timeline", label: "Timeline", icon: <ListBullets size={14} /> },
    { id: "code", label: "Code", icon: <FileCode size={14} /> },
    { id: "changes", label: "Changes", icon: <GitDiff size={14} />, count: changes?.length ?? 0 },
    { id: "browser", label: "Browser", icon: <Browser size={14} /> },
  ];
  const lastBrowse = [...live.events].reverse().find((e) => e.kind === "browse");
  const candidatePage = lastBrowse ? String(lastBrowse.data.address ?? "") : "";
  const htmlFiles = live.files.filter((f) => !f.dir && kindOf(f.path) === "html").map((f) => f.path);

  return (
    <MotionConfig reducedMotion="user">
    <div className={`${ui.root} ${ui.app} ${terminalFont.variable}`}>
      <header className={ui.header}>
        <Link href="/sessions" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} style={{ paddingLeft: 6 }}><ArrowLeft size={13} /> Sessions</Link>
        <span className={ui.divider} />
        <span style={{ fontWeight: 600, minWidth: 0, flexShrink: 0, maxWidth: 260 }} className={ui.ellipsis} title={live.candidate}>{live.candidate}</span>
        <span className={`${ui.chip} ${ui.chipLive}`}><span className={ui.recDot} style={{ width: 6, height: 6, boxShadow: "none" }} />Live</span>
        {live.challenge && (
          <span className={ui.chip} style={{ minWidth: 0, flexShrink: 1, maxWidth: 320 }} title={live.challenge.title}>
            <span className={ui.mono} style={{ color: "var(--w-accent-2)" }}>{String(live.currentIndex + 1).padStart(2, "0")}/{String(live.total).padStart(2, "0")}</span>
            <span className={ui.ellipsis}>{live.challenge.title}</span>
          </span>
        )}
        {setup && <SetupChip view={setup} />}
        <span className={ui.faint} title={`You joined as an admin. ${who} sees that you are watching.`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, minWidth: 16, flexShrink: 4, overflow: "hidden", whiteSpace: "nowrap" }} data-el="admin-badge"><Eye size={13} style={{ flex: "none" }} /><span className={ui.ellipsis}>{who} sees you</span></span>
        <div className={ui.headRight}>
          <div className={ui.group}>
            <button type="button" className={ui.btn} onClick={() => setMsgOpen((v) => !v)} aria-expanded={msgOpen} data-el="message-candidate"><PaperPlaneTilt size={13} /> Message</button>
            <button type="button" className={ui.btn} disabled={busy === "add time"} onClick={() => void run("add time", () => addTime(sessionId))} data-el="add-time"><Plus size={12} weight="bold" /> 10 min</button>
          </div>
          <span className={ui.divider} />
          <div className={ui.group}>
          <button type="button" className={`${ui.btn} ${ui.btnDanger}`} disabled={!live.aiActive} onClick={() => confirm("Turn off AI access for this session now? It can't be turned back on.") && void run("turn off AI", () => cutAi(sessionId))} data-el="cut-ai"><Power size={13} /> {live.aiActive ? "Cut AI" : "AI off"}</button>
          <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => confirm("End the session now? The candidate loses access and the hidden tests run.") && void run("end the session", () => endSession(sessionId))} data-el="end-session"><StopCircle size={14} /> End</button>
          </div>
        </div>
      </header>

      <AnimatePresence initial={false}>
      {msgOpen && (
        <motion.form
          key="message"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={spring}
          onSubmit={(e) => void submitForm(e, "send the message", (fd) => messageCandidate(sessionId, fd), () => setMsgOpen(false))}
          style={{ display: "flex", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--w-line)", background: "var(--w-panel)", overflow: "hidden" }}
        >
          <input className={ui.input} name="message" placeholder={`${who} sees this as a notification over the agent session`} autoFocus aria-label="Message to the candidate" />
          <button className={`${ui.btn} ${ui.btnPrimary}`} style={{ height: 34 }}>Send</button>
        </motion.form>
      )}
      </AnimatePresence>

      <div className={ui.statusBar} style={{ height: 40, borderTop: 0, borderBottom: "1px solid var(--w-line)", gap: 22, fontSize: 12.5, color: "var(--w-fg-2)" }} data-el="status-strip">
        <span className={ui.statusItem} style={{ color: low ? "var(--w-warn)" : undefined }}><Clock size={14} /><span className={ui.mono} style={{ fontSize: 13.5, color: low ? undefined : "var(--w-fg)" }}>{clock(left)}</span> left</span>
        <span className={ui.statusItem}><Flask size={14} />{live.tests?.total ? <><span className={ui.mono} style={{ color: live.tests.passed === live.tests.total ? "var(--w-ok)" : "var(--w-warn)" }}>{String(live.tests.passed)}/{String(live.tests.total)}</span> tests</> : <span className={ui.faint}>tests not run yet</span>}</span>
        <span className={ui.statusItem}><ChatCircleText size={14} /><span className={ui.mono} style={{ color: "var(--w-fg)" }}>{turns.length}</span> prompts</span>
        <span className={ui.statusItem} style={{ color: pasted ? "var(--w-warn)" : undefined }}><Crosshair size={14} /><span className={ui.mono}>{pasted}</span> pastes</span>
        <span className={ui.statusItem} style={{ marginLeft: "auto" }}>
          <Sparkle size={13} weight="fill" color="#d97757" />
          <span className={ui.mono} style={{ color: "var(--w-fg)" }}>${live.spent.toFixed(2)}</span><span className={ui.faint}>/ ${live.budget}</span>
          <span className={ui.meter} style={{ width: 90 }}><i style={{ width: `${spentPct}%`, background: live.aiActive ? undefined : "var(--w-fg-4)" }} /></span>
        </span>
      </div>

      <div className={ui.body}>
        <section className={ui.agent} data-el="mirror">
          {multi && (
            <div className={ui.agentCards} role="tablist" aria-label="Candidate's agents" data-el="agent-cards">
              {agents.map((a) => (
                <button key={a.key} type="button" role="tab" aria-selected={focused?.key === a.key} className={`${ui.agentCard} ${focused?.key === a.key ? ui.agentCardActive : ""}`} onClick={() => setFocusAgent(a.key)} data-el="agent-card" data-status={a.status}>
                  <span className={ui.agentCardHead}>
                    <span className={ui.agentDot} data-state={statusDot[a.status]} aria-hidden="true" />
                    <span className={ui.ellipsis} style={{ fontWeight: 600, color: "var(--w-head)" }}>{a.name}</span>
                    <span className={ui.agentCardStatus} data-status={a.status} title={statusHint[a.status]}>{statusLabel[a.status]}</span>
                  </span>
                  <span className={ui.agentCardPrompt}>{a.lastPrompt ?? "No prompt yet"}</span>
                  <span className={ui.agentCardMeta}>{a.prompts} {a.prompts === 1 ? "prompt" : "prompts"} · ${a.cost.toFixed(2)}{a.mergedAt ? " · merged" : ""}</span>
                </button>
              ))}
            </div>
          )}
          <div className={ui.agentBar}>
            <div className={ui.agentTitle}>
              <span className={ui.buddySlot}><AgentBuddy state={!live.aiActive ? "error" : agentBusy ? "working" : turns.length ? "done" : "idle"} size={34} appear={false} label="Candidate's agent" /></span>
              {multi && focused ? focused.name : "Claude Code"}
            </div>
            <span className={ui.faint} style={{ whiteSpace: "nowrap" }}>{who}&apos;s {multi ? `${openAgents.length} agents` : "session"}</span>
            <span className={`${ui.chip} ${status === "live" ? ui.chipOk : status === "offline" ? ui.chipWarn : ""}`}><span className={ui.dot} />{status === "live" ? "Streaming" : status === "offline" ? "Reconnecting" : "Connecting"}</span>
            <span className={ui.hints}><span className={ui.chip}>Read only</span></span>
          </div>
          {!live.aiActive && (
            <div className={`${ui.banner} ${ui.bannerErr}`}><span className={ui.dot} style={{ color: "var(--w-err)" }} />AI access is off for this session.</div>
          )}
          <div className={ui.termWrap}>
            <TerminalView key={focused?.key ?? "main"} sessionId={sessionId} agent={focused?.key ?? "main"} readOnly onStatus={setStatus} fontSize={13} />
          </div>
          <form
            onSubmit={(e) => void submitForm(e, "save the note", (fd) => addNote(sessionId, fd))}
            data-el="private-note"
            style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px 8px 16px", borderTop: "1px solid var(--w-line)", background: "var(--w-panel)" }}
          >
            <span className={ui.avatar} style={{ background: "rgba(244,114,182,.15)", color: "var(--w-intv)" }}><NotePencil size={13} /></span>
            <input name="note" placeholder="Private note for the team, pinned to this minute…" aria-label="Private note" style={{ flex: 1, height: 34, background: "transparent", border: 0, outline: "none", color: "var(--w-fg)", font: "inherit" }} />
            <button className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} disabled={busy === "save the note"}>{busy === "save the note" ? "Saving…" : "Add note"} <Keys keys={["enter"]} /></button>
          </form>
        </section>

        <aside className={ui.panel} style={{ width: wide ? "min(820px, 55vw)" : 420 }} data-el="side-panel">
          <div className={ui.tabs}>
            {sides.map((s) => (
              <button key={s.id} type="button" className={ui.tab} style={side === s.id ? { color: "var(--w-head)" } : undefined} aria-label={s.label} title={s.label} onClick={() => {
                  setSide(s.id);
                  if (s.id === "browser") setBrowserVisited(true);
                }} aria-pressed={side === s.id}>
                {side === s.id && <TabIndicator id="live-tab" />}
                <span className={ui.tabLabel}>{s.icon}{(wide || side === s.id) && s.label}{s.count !== undefined && s.count > 0 && <span className={ui.count}>{s.count}</span>}</span>
              </button>
            ))}
            <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} style={{ marginLeft: "auto" }} onClick={() => setWide((v) => !v)} aria-label={wide ? "Narrow panel" : "Widen panel"} title={wide ? "Narrow panel" : "Widen panel"}>
              {wide ? <ArrowsInLineHorizontal size={15} /> : <ArrowsOutLineHorizontal size={15} />}
            </button>
          </div>

          {side === "changes" ? (
            <div className={ui.panelBody}>
              {multi && (
                <div className={ui.scopeBar}>
                  <span className={ui.segmented} role="group" aria-label="Whose changes">
                    {agents.filter((a) => a.status !== "closed").map((a) => (
                      <button key={a.key} type="button" aria-pressed={changesAgent === a.key} onClick={() => setChangesAgent(a.key)}>{a.key === "main" ? "Workspace" : a.name}</button>
                    ))}
                  </span>
                </div>
              )}
              <ChangesPanel changes={changes} who={changesAgent === "main" ? who : agentNames.get(changesAgent)} />
            </div>
          ) : side === "browser" ? null : side === "code" ? (
            <FilesView
              files={live.files}
              tabs={fileTabs}
              readOnly
              wide={wide}
              toolbar={
                <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, cursor: "pointer", minWidth: 0 }} className={ui.muted}>
                  <input type="checkbox" className={ui.check} checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow {who}
                  {follow && live.focus && <span className={`${ui.faint} ${ui.ellipsis}`}>on {live.focus}</span>}
                </label>
              }
            />
          ) : (
            <div ref={feedRef} className={ui.scroll} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16, fontSize: 12.5, lineHeight: 1.55 }}>
              {side === "prompts" ? (
                turns.length || internal.length ? (
                  <>
                    <AnimatePresence initial={false}>
                      {turns.map((t, i) => <PromptRow key={t.id} t={t} start={live.startedAt} who={who} agentName={multi ? agentNames.get(t.agent) : undefined} working={multi ? agents.find((a) => a.key === t.agent)?.status === "working" && turns.filter((x) => x.agent === t.agent).at(-1)?.id === t.id : i === turns.length - 1 && agentBusy} />)}
                    </AnimatePresence>
                    {internal.length > 0 && (
                      <div data-el="internal-calls">
                        <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} style={{ paddingLeft: 0 }} onClick={() => setShowInternal((v) => !v)} aria-expanded={showInternal}>
                          {showInternal ? "Hide" : "Show"} {internal.length} internal Claude Code {internal.length === 1 ? "call" : "calls"} <span className={ui.mono} style={{ color: "var(--w-fg-3)" }}>${internalCost.toFixed(3)}</span>
                        </button>
                        {showInternal && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                            {[...internal].reverse().map((c) => <InternalRow key={c.id} c={c} start={live.startedAt} />)}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className={ui.empty}>
                    <div className={ui.emptyInner}>
                      <Sprout mood="sleeping" size={96} />
                      <span style={{ color: "var(--w-head)", fontWeight: 500, fontSize: 13 }}>No prompts yet</span>
                      Every message {who} sends to Claude shows up here, with the tools it used and the cost.
                    </div>
                  </div>
                )
              ) : timeline.length ? (
                timeline.map((t) => t.node)
              ) : (
                <Empty icon={<ListBullets size={18} />} title="Nothing yet" />
              )}
            </div>
          )}

          {browserVisited && (
            <div className={ui.panelBody} style={{ display: side === "browser" ? "flex" : "none" }}>
              <BrowserPane
                key={live.currentIndex}
                endpoint={`/api/admin/sessions/${sessionId}/preview`}
                agentScreen={`/api/admin/sessions/${sessionId}/agent-screen`}
                active={side === "browser"}
                htmlFiles={htmlFiles}
                preferred={candidatePage ? parseAddress(candidatePage, null) : null}
                extra={
                  candidatePage
                    ? (open) => (
                        <button
                          type="button"
                          className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`}
                          onClick={() => {
                            const address = parseAddress(candidatePage, null);
                            if (address) open(address);
                          }}
                          data-el="candidate-page"
                        >
                          <Eye size={13} /> {who} is on <span className={ui.mono} style={{ color: "var(--w-fg)" }}>{candidatePage}</span>
                        </button>
                      )
                    : undefined
                }
              />
            </div>
          )}

          {live.challenge?.traps.length && side !== "code" && side !== "changes" && side !== "browser" ? (
            <details style={{ flex: "none", margin: "0 12px 12px", borderRadius: 10, border: "1px dashed var(--w-line-2)", padding: "10px 12px", fontSize: 12.5, lineHeight: 1.55 }} className={ui.muted} data-el="traps">
              <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 7, color: "var(--w-fg)", fontWeight: 500, listStyle: "none" }}><Target size={14} style={{ color: "var(--w-warn)" }} /> Traps to probe in the debrief <span className={ui.count}>{live.challenge.traps.length}</span></summary>
              <ul style={{ margin: "8px 0 0", padding: "0 0 0 18px", listStyle: "disc" }}>{live.challenge.traps.map((t) => <li key={t}>{t}</li>)}</ul>
            </details>
          ) : null}
        </aside>
      </div>
      <AnimatePresence>
      {failure && (
        <motion.div key="failure" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={spring} role="alert" className={ui.liveToast} data-el="action-error">
          <span style={{ flex: 1, lineHeight: 1.5 }}>{failure}</span>
          {/reload/i.test(failure) && <button type="button" className={`${ui.btn} ${ui.btnSm}`} onClick={() => location.reload()}>Reload</button>}
          <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} onClick={() => setFailure(null)} aria-label="Dismiss"><X size={13} /></button>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}

function EventRow({ e, start }: { e: Live["events"][number]; start: string | null }) {
  const text = eventText[e.kind]?.(e.data) ?? e.kind;
  const actor = e.actor === "candidate" ? "Candidate" : e.actor === "system" ? "System" : e.actor;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
      <span className={`${ui.mono} ${ui.faint}`} style={{ width: 42, flex: "none", fontSize: 11.5 }}>{since(start, e.at)}</span>
      <span className={ui.dot} style={{ color: toneFor[e.kind] ?? "var(--w-fg-4)", transform: "translateY(-1px)" }} />
      <div style={{ minWidth: 0 }}>
        <span style={{ color: "var(--w-fg)", fontWeight: 500 }}>{actor}</span> <span className={ui.muted} style={{ wordBreak: "break-word" }}>{text}</span>
      </div>
    </div>
  );
}

function InternalRow({ c, start }: { c: RecordedCall; start: string | null }) {
  return (
    <div className={ui.faint} style={{ display: "flex", gap: 8, fontSize: 11.5, minWidth: 0 }}>
      <span className={ui.mono} style={{ flex: "none" }}>{since(start, c.at)}</span>
      <span className={ui.ellipsis} style={{ flex: 1 }} title={c.prompt ?? ""}>{c.prompt?.replace(/\s+/g, " ").slice(0, 160) || "(no prompt)"}</span>
      <span className={ui.mono} style={{ flex: "none" }}>${c.cost.toFixed(3)}</span>
    </div>
  );
}

function PromptRow({ t, start, compact, who, working, agentName }: { t: Turn; start: string | null; compact?: boolean; who: string; working?: boolean; agentName?: string }) {
  const [more, setMore] = useState(false);
  if (compact) {
    return (
      <div data-el="prompt-item" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span className={`${ui.mono} ${ui.faint}`} style={{ width: 42, flex: "none", fontSize: 11.5, paddingTop: 2 }}>{since(start, t.at)}</span>
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={ui.turnMeta}><span style={{ color: "var(--w-cand)", fontWeight: 500 }}>{who}</span> prompted {agentName ?? "Claude"}{t.steps > 1 ? ` · ${t.steps} steps` : ""}</div>
          <div className={ui.bubbleMe} style={{ alignSelf: "stretch", maxWidth: "none", maxHeight: 96 }}><Markdown text={t.prompt} /></div>
        </div>
      </div>
    );
  }
  const long = (t.response?.length ?? 0) > 500 || t.prompt.length > 600;
  return (
    <motion.div layout data-el="prompt-item" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className={ui.turnMeta} style={{ justifyContent: "flex-end" }}>
        <span className={ui.mono}>{since(start, t.at)}</span>
        <span style={{ color: "var(--w-cand)", fontWeight: 500 }}>{who}</span>
        {agentName && <span className={ui.chip} style={{ height: 18, fontSize: 10.5 }} data-el="prompt-agent">{agentName}</span>}
        {t.source === "panel" && <span className={ui.chip} style={{ height: 18, fontSize: 10.5 }}>panel</span>}
      </div>
      <div className={ui.bubbleMe} style={{ maxHeight: more ? undefined : 220 }}><Markdown text={t.prompt} /></div>
      <div className={ui.bubbleAgent}>
        <span className={ui.agentGlyph} style={{ width: 24, height: 24, borderRadius: 8, marginTop: 2 }}><Sparkle size={12} weight="fill" /></span>
        <div className={ui.bubbleAgentBody}>
          {t.tools.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: t.response || working ? 8 : 0 }}>
              {t.tools.map((tool) => <ToolChip key={tool} name={tool} />)}
            </div>
          )}
          {t.response ? (
            <div style={{ maxHeight: more ? undefined : 240, overflow: "hidden" }}><Markdown text={t.response} /></div>
          ) : working ? (
            <Thinking label="Claude is working" />
          ) : (
            <span className={ui.faint}>{t.tools.length ? "Worked with tools, no written reply." : "No written reply."}</span>
          )}
          {t.response && working && <div style={{ marginTop: 8 }}><Thinking label="Still working" /></div>}
          <div className={ui.turnMeta} style={{ marginTop: 8 }}>
            {t.steps > 1 && <span>{t.steps} steps</span>}
            {t.failed > 0 && <span style={{ color: "var(--w-err)" }}>{t.failed} failed</span>}
            <span className={ui.mono} style={{ marginLeft: "auto" }}>${t.cost.toFixed(3)}</span>
            {long && <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} style={{ height: 22, padding: "0 6px" }} onClick={() => setMore((v) => !v)}>{more ? "Show less" : "Show more"}</button>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
