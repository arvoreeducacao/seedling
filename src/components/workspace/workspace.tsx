"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowsInLineHorizontal, ArrowsOutLineHorizontal, Browser, Check, Clock, FileText, Flask, FolderSimple, GitDiff, GitMerge, Lock, SidebarSimple, X } from "@phosphor-icons/react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { clock } from "@/lib/format";
import { Keys, Shimmer, TabIndicator, spring } from "./ai";
import { Logo, Sprout, Stopwatch } from "@/components/brand";
import { AgentDeck, type AgentTab } from "./agent-deck";
import { BriefPanel, ChangesPanel, TestsPanel, useChanges, type Challenge, type TestResult } from "./panels";
import { FilesView, useFileTabs, type Doc, type Entry } from "./files";
import { BrowserPane, type BrowserRequest } from "./browser";
import { kindOf } from "./file-kinds";
import { terminalFont } from "@/components/workspace/fonts";
import ui from "./ui.module.css";

type State = {
  status: string;
  practice: "playground" | "challenge" | null;
  remainingMs: number;
  currentIndex: number;
  total: number;
  challenges: { title: string; kind: string; minutes: number }[];
  challenge: Challenge | null;
  ai: { active: boolean; spent: number; budget: number; reason: string | null; model: string };
  watchers: string[];
  messages: { id: string; text: string; from: string }[];
};

type Tab = "brief" | "files" | "changes" | "tests" | "preview";

const PANEL_KEY = "seedling:panel";
const MIN_PANEL = 340;

function readPanel(): { width: number; open: boolean } | null {
  try {
    const raw = window.localStorage.getItem(PANEL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePanel(value: { width: number; open: boolean }) {
  try {
    window.localStorage.setItem(PANEL_KEY, JSON.stringify(value));
  } catch {}
}

function track(token: string, kind: string, data: Record<string, unknown>) {
  void fetch(`/api/s/${token}/event`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, data }) });
}

export function Workspace({ token, sessionId }: { token: string; sessionId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [left, setLeft] = useState(0);
  const [files, setFiles] = useState<Entry[]>([]);
  const [tab, setTab] = useState<Tab>("brief");
  const [panelOpen, setPanelOpen] = useState(true);
  const [width, setWidth] = useState(460);
  const [dragging, setDragging] = useState(false);
  const [testOut, setTestOut] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [toast, setToast] = useState<{ from: string; text: string } | null>(null);
  const [browserRequest, setBrowserRequest] = useState<BrowserRequest | null>(null);
  const [browserVisited, setBrowserVisited] = useState(false);
  const [searchFocus, setSearchFocus] = useState(0);
  const seenMessages = useRef(new Set<string>());
  const lastBrowse = useRef("");
  const [agents, setAgents] = useState<AgentTab[]>([{ key: "main", name: "Main", createdAt: null, closedAt: null, mergedAt: null }]);
  const [maxAgents, setMaxAgents] = useState(4);
  const [activeAgent, setActiveAgent] = useState("main");
  const [scope, setScope] = useState("main");
  const [merging, setMerging] = useState(false);
  const [mergeNote, setMergeNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [mergeTick, setMergeTick] = useState(0);
  const totalRef = useRef(0);
  const changes = useChanges(`/api/s/${token}/changes?g=${generation}&m=${mergeTick}`, panelOpen && tab === "changes" && scope === "main");
  const agentChanges = useChanges(scope === "main" ? null : `/api/s/${token}/agents/${scope}/changes?m=${mergeTick}`, panelOpen && tab === "changes");
  const loadAgents = useCallback(async () => {
    const res = await fetch(`/api/s/${token}/agents`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const json = await res.json();
    setAgents(json.agents);
    setMaxAgents(json.max);
  }, [token]);

  useEffect(() => {
    void loadAgents();
    setActiveAgent("main");
    setScope("main");
    const timer = setInterval(() => void loadAgents(), 4000);
    return () => clearInterval(timer);
  }, [loadAgents, generation]);

  useEffect(() => {
    if (!agents.some((a) => a.key === scope && !a.closedAt)) setScope("main");
  }, [agents, scope]);

  async function mergeAgent(key: string) {
    setMerging(true);
    setMergeNote(null);
    const res = await fetch(`/api/s/${token}/agents/${key}/merge`, { method: "POST" }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setMerging(false);
    const name = agents.find((a) => a.key === key)?.name ?? "the agent";
    if (json?.ok) {
      setMergeNote({ ok: true, text: json.files ? `Merged ${json.files} ${json.files === 1 ? "file" : "files"} from ${name} into the workspace.` : `${name} had nothing new to merge.` });
      setScope("main");
      void loadFiles();
    } else setMergeNote({ ok: false, text: json?.message ?? "The merge didn't go through. Try again." });
    setMergeTick((n) => n + 1);
    await loadAgents();
  }
  const fileSource = useMemo(
    () => ({
      async read(path: string): Promise<Doc> {
        const res = await fetch(`/api/s/${token}/file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
        if (res.status === 404) return { content: null, missing: true };
        if (!res.ok) throw new Error("could not read");
        return res.json();
      },
      async save(path: string, text: string) {
        const res = await fetch(`/api/s/${token}/file`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, content: text }) });
        return res.ok;
      },
      rawUrl(path: string, version?: number, download?: boolean) {
        return `/api/s/${token}/raw?path=${encodeURIComponent(path)}${version ? `&v=${version}` : ""}${download ? "&download=1" : ""}`;
      },
    }),
    [token],
  );
  const onOpened = useCallback((path: string) => track(token, "file-open", { path }), [token]);
  const fileTabs = useFileTabs(fileSource, { onOpened });
  const onBrowse = useCallback(
    (address: string) => {
      if (address === lastBrowse.current) return;
      lastBrowse.current = address;
      track(token, "browse", { address });
    },
    [token],
  );

  useEffect(() => {
    const stored = readPanel();
    if (stored) {
      setWidth(Math.max(MIN_PANEL, stored.width));
      setPanelOpen(stored.open);
    }
  }, []);

  useEffect(() => {
    writePanel({ width, open: panelOpen });
  }, [width, panelOpen]);

  const loadState = useCallback(async () => {
    const res = await fetch(`/api/s/${token}/state`, { cache: "no-store" });
    if (!res.ok) {
      router.replace(`/s/${token}/fim`);
      return;
    }
    const json: State = await res.json();
    if (json.status !== "running") {
      router.replace(`/s/${token}/fim`);
      return;
    }
    setState(json);
    setLeft(json.remainingMs);
    totalRef.current = Math.max(totalRef.current, json.remainingMs);
    for (const m of json.messages) {
      if (!seenMessages.current.has(m.id)) {
        if (seenMessages.current.size > 0 || json.messages.length === 1) setToast({ from: m.from, text: m.text });
        seenMessages.current.add(m.id);
      }
    }
  }, [router, token]);

  const loadFiles = useCallback(async () => {
    const res = await fetch(`/api/s/${token}/files`, { cache: "no-store" });
    if (res.ok) setFiles((await res.json()).files);
  }, [token]);

  useEffect(() => {
    void loadState();
    void loadFiles();
    const poll = setInterval(() => void loadState(), 4000);
    const filePoll = setInterval(() => void loadFiles(), 5000);
    const tick = setInterval(() => setLeft((ms) => Math.max(0, ms - 1000)), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(filePoll);
      clearInterval(tick);
    };
  }, [loadState, loadFiles, generation]);

  useEffect(() => {
    if (state && left === 0) void loadState();
  }, [left, state, loadState]);

  function openFile(path: string) {
    fileTabs.open(path);
    setTab("files");
    setPanelOpen(true);
  }

  function openInBrowser(path: string) {
    setBrowserRequest({ address: { port: 0, path: `/${path}` }, nonce: Date.now() });
    setBrowserVisited(true);
    setTab("preview");
    setPanelOpen(true);
  }

  async function runTests() {
    if (!state?.challenge?.visibleTestCommand || testing) return;
    setTab("tests");
    setPanelOpen(true);
    setTesting(true);
    await fileTabs.flush();
    const res = await fetch(`/api/s/${token}/test`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setTestOut({ output: json.output ?? json.error ?? "", passed: json.passed ?? 0, total: json.total ?? 0 });
    setTesting(false);
  }

  async function submit() {
    setSubmitting(true);
    await fileTabs.flush();
    const res = await fetch(`/api/s/${token}/submit`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (json.finished || !res.ok) {
      router.replace(`/s/${token}/fim`);
      return;
    }
    fileTabs.reset();
    setTestOut(null);
    setTab("brief");
    setPanelOpen(true);
    await loadState();
    setSubmitting(false);
    setConfirming(false);
    setGeneration((g) => g + 1);
  }

  function choose(next: Tab) {
    if (panelOpen && tab === next) setPanelOpen(false);
    else {
      setTab(next);
      setPanelOpen(true);
      if (next === "preview") setBrowserVisited(true);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        void runTests();
      } else if (mod && e.key.toLowerCase() === "p" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        setTab("files");
        setPanelOpen(true);
        setSearchFocus((n) => n + 1);
      } else if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        e.stopPropagation();
        setPanelOpen((v) => !v);
      } else if (e.key === "Escape" && confirming && !submitting) {
        setConfirming(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    setDragging(true);
    const move = (ev: PointerEvent) => {
      const max = Math.min(980, window.innerWidth - 520);
      setWidth(Math.round(Math.min(max, Math.max(MIN_PANEL, startW + (startX - ev.clientX)))));
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  if (!state) {
    return (
      <div className={`${ui.root} ${ui.loading}`}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <Sprout mood="thinking" size={112} />
          <Shimmer>Opening your workspace</Shimmer>
        </div>
      </div>
    );
  }

  const low = left < 5 * 60_000;
  const challenge = state.challenge;
  const isLast = state.currentIndex + 1 >= state.total;
  const playground = state.practice === "playground";
  const wide = width >= 700;
  const spentPct = state.ai.budget ? Math.min(100, (state.ai.spent / state.ai.budget) * 100) : 0;
  const openAgents = agents.filter((a) => !a.closedAt);
  const htmlFiles = files.filter((f) => !f.dir && kindOf(f.path) === "html").map((f) => f.path);
  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: React.ReactNode }[] = [
    { id: "brief", label: "Brief", icon: <FileText size={18} /> },
    { id: "files", label: "Files", icon: <FolderSimple size={18} /> },
    {
      id: "changes",
      label: "Changes",
      icon: <GitDiff size={18} />,
      badge: changes && changes.length > 0 ? <span className={ui.railBadge} style={{ background: "var(--w-accent)", color: "#fff" }}>{changes.length}</span> : null,
    },
    {
      id: "tests",
      label: "Tests",
      icon: <Flask size={18} />,
      badge: testOut && testOut.total > 0 ? <span className={ui.railBadge} style={{ background: testOut.passed === testOut.total ? "var(--w-ok)" : "var(--w-warn)", color: "#0b0b0d" }}>{testOut.passed}</span> : null,
    },
    { id: "preview", label: "Browser", icon: <Browser size={18} /> },
  ];
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <MotionConfig reducedMotion="user">
    <div className={`${ui.root} ${ui.app} ${terminalFont.variable}`} style={dragging ? { cursor: "col-resize", userSelect: "none" } : undefined}>
      <header className={ui.header} data-el="session-bar">
        <div className={ui.brand}>
          <Logo variant="full" size={22} animated={false} />
        </div>
        <span className={ui.divider} />
        <nav className={ui.steps} aria-label="Challenges" data-el="steps">
          {state.challenges.map((c, i) =>
            i < state.currentIndex ? (
              <span key={i} className={`${ui.step} ${ui.stepDone}`} title={`${c.title} · submitted`}><Check size={11} weight="bold" /><span className={ui.stepNum} style={{ color: "inherit" }}>{String(i + 1).padStart(2, "0")}</span></span>
            ) : i === state.currentIndex ? (
              <span key={i} className={`${ui.step} ${ui.stepCurrent}`} aria-current="step"><span className={ui.stepNum}>{String(i + 1).padStart(2, "0")}</span><span className={ui.ellipsis}>{c.title}</span></span>
            ) : (
              <span key={i} className={ui.step} title="Unlocks when you submit the previous one"><Lock size={11} /><span className={ui.stepNum}>{String(i + 1).padStart(2, "0")}</span></span>
            ),
          )}
        </nav>
        <div className={ui.headRight}>
          <div className={ui.group}>
            <AnimatePresence>
              {state.watchers.length > 0 && (
                <motion.span key="watching" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={ui.watching} data-el="being-watched" title={`${state.watchers.join(", ")} watching`}>
                  <span className={ui.dot} />
                  <span className={ui.ellipsis}>{state.watchers.length === 1 ? `${state.watchers[0].split(" ")[0]} is watching` : `${state.watchers.length} watching`}</span>
                </motion.span>
              )}
            </AnimatePresence>
            {!playground && <span className={ui.rec} data-el="recording" title="Terminal, files and AI calls are recorded"><span className={ui.recDot} />Rec</span>}
          </div>
          <span className={ui.divider} />
          <div className={ui.group} style={{ gap: 16 }}>
            <div className={ui.budget} data-el="ai-budget" title={state.ai.active ? "AI budget used by Claude Code" : state.ai.reason ?? "AI access is off"}>
              <div className={ui.budgetRow}>
                <span>{state.ai.active ? "AI budget" : "AI off"}</span>
                <span className={ui.mono} style={{ color: "var(--w-fg-2)" }}>${state.ai.spent.toFixed(2)}<span className={ui.faint}>/{state.ai.budget}</span></span>
              </div>
              <div className={ui.meter}><motion.i initial={false} animate={{ width: `${spentPct}%` }} transition={spring} style={{ background: !state.ai.active ? "var(--w-fg-4)" : spentPct > 85 ? "var(--w-err)" : undefined }} /></div>
            </div>
            <Stopwatch progress={totalRef.current ? left / totalRef.current : 1} running={left > 0} urgent={left < 2 * 60_000} size={24} appear={false} label={`${clock(left)} left`} />
            <motion.div className={`${ui.timer} ${low ? ui.timerLow : ""}`} role="timer" aria-label={`${clock(left)} left`} data-el="timer" animate={low ? { scale: [1, 1.05, 1] } : { scale: 1 }} transition={low ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}>
              <Clock size={14} />
              {clock(left)}
            </motion.div>
          </div>
          <span className={ui.divider} />
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => setConfirming(true)} data-el="submit">
            {playground ? "End playground" : isLast ? "Submit and finish" : `Submit ${String(state.currentIndex + 1).padStart(2, "0")}`}
          </button>
        </div>
      </header>

      <div className={ui.body}>
        <AgentDeck token={token} sessionId={sessionId} challengeIndex={state.currentIndex} generation={generation} model={state.ai.model} aiActive={state.ai.active} aiReason={state.ai.reason} agents={agents} max={maxAgents} active={activeAgent} onSelect={setActiveAgent} onChanged={loadAgents} />

        <AnimatePresence>
        {toast && (
          <motion.div key="toast" initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={spring} role="status" className={ui.toast} style={{ right: (panelOpen ? width : 0) + 64 }} data-el="interviewer-message">
            <span className={ui.avatar} style={{ background: "var(--w-intv)", color: "#0b0b0d" }}>{toast.from.slice(0, 1).toUpperCase()}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: "var(--w-intv)", fontWeight: 500 }}>{toast.from} · interviewer</div>
              <div style={{ marginTop: 3, lineHeight: 1.5 }}>{toast.text}</div>
            </div>
            <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} onClick={() => setToast(null)} aria-label="Dismiss"><X size={13} /></button>
          </motion.div>
        )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
        {panelOpen && (
          <motion.aside key="panel" className={ui.panel} initial={{ width: 0, opacity: 0 }} animate={{ width, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={dragging ? { duration: 0 } : spring} style={{ maxWidth: "calc(100vw - 568px)", overflow: "visible" }} aria-label={current.label} data-el="side-panel">
            <div style={{ width, minWidth: MIN_PANEL, maxWidth: "calc(100vw - 568px)", height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
            <div className={`${ui.resizer} ${dragging ? ui.resizerActive : ""}`} onPointerDown={startDrag} role="separator" aria-orientation="vertical" aria-label="Resize panel" />
            <div className={ui.panelHead}>
              <span className={ui.panelTitle}>{current.label}</span>
              {tab === "files" && <span className={ui.count}>{files.filter((f) => !f.dir).length}</span>}
              {tab === "changes" && changes && changes.length > 0 && <span className={ui.count}>{changes.length} {changes.length === 1 ? "file" : "files"} · <span style={{ color: "var(--w-ok)" }}>+{changes.reduce((n, c) => n + c.added, 0)}</span>{changes.some((c) => c.removed > 0) && <span style={{ color: "var(--w-err)" }}> −{changes.reduce((n, c) => n + c.removed, 0)}</span>}</span>}
              {tab === "tests" && testOut && testOut.total > 0 && <span className={`${ui.chip} ${testOut.passed === testOut.total ? ui.chipOk : ui.chipWarn}`}>{testOut.passed}/{testOut.total} passing</span>}
              <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} onClick={() => setWidth(wide ? 460 : Math.min(900, Math.round(window.innerWidth * 0.55)))} aria-label={wide ? "Narrow panel" : "Widen panel"} title={wide ? "Narrow panel" : "Widen panel"}>
                  {wide ? <ArrowsInLineHorizontal size={15} /> : <ArrowsOutLineHorizontal size={15} />}
                </button>
                <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} onClick={() => setPanelOpen(false)} aria-label="Hide panel" title="Hide panel (Cmd+B)"><SidebarSimple size={15} style={{ transform: "scaleX(-1)" }} /></button>
              </span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
            {tab !== "preview" && (
            <motion.div key={tab} className={ui.panelBody} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.16 }}>
              {tab === "brief" && <BriefPanel challenge={challenge} index={state.currentIndex} total={state.total} playground={playground} />}
              {tab === "files" && (
                <FilesView
                  files={files}
                  tabs={fileTabs}
                  wide={width >= 640}
                  generation={generation}
                  focusSearch={searchFocus}
                  onOpenInBrowser={openInBrowser}
                  onPaste={(chars) => {
                    if (chars > 40) track(token, "paste", { path: fileTabs.active ?? "", chars });
                  }}
                />
              )}
              {tab === "changes" && (
                <div className={ui.panelBody}>
                  {openAgents.length > 1 && (
                    <div className={ui.scopeBar} data-el="changes-scope">
                      <span className={ui.segmented} role="group" aria-label="Whose changes">
                        {openAgents.map((a) => (
                          <button key={a.key} type="button" aria-pressed={scope === a.key} onClick={() => { setScope(a.key); setMergeNote(null); }}>{a.key === "main" ? "Workspace" : a.name}</button>
                        ))}
                      </span>
                    </div>
                  )}
                  {scope !== "main" && (
                    <div className={ui.scopeNote}>
                      <span className={ui.muted} style={{ flex: 1 }}>What {agents.find((a) => a.key === scope)?.name} changed in its own copy, compared with the workspace when it started.</span>
                      <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${ui.btnSm}`} style={{ flex: "none" }} onClick={() => void mergeAgent(scope)} disabled={merging || !agentChanges?.length} data-el="merge-agent">
                        <GitMerge size={13} /> {merging ? "Merging…" : "Merge into workspace"}
                      </button>
                    </div>
                  )}
                  {mergeNote && (
                    <div className={`${ui.banner} ${mergeNote.ok ? "" : ui.bannerWarn}`} role="status" data-el="merge-result">
                      <span className={ui.dot} style={{ color: mergeNote.ok ? "var(--w-ok)" : "var(--w-warn)" }} />
                      <span style={{ flex: 1 }}>{mergeNote.text}</span>
                      <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} onClick={() => setMergeNote(null)} aria-label="Dismiss"><X size={12} /></button>
                    </div>
                  )}
                  <ChangesPanel changes={scope === "main" ? changes : agentChanges} onOpen={scope === "main" ? openFile : undefined} who={scope === "main" ? undefined : agents.find((a) => a.key === scope)?.name} />
                </div>
              )}
              {tab === "tests" && <TestsPanel command={challenge?.visibleTestCommand ?? null} result={testOut} running={testing} onRun={() => void runTests()} />}
            </motion.div>
            )}
            </AnimatePresence>
            {browserVisited && (
              <div className={ui.panelBody} style={{ display: tab === "preview" ? "flex" : "none" }}>
                <BrowserPane key={generation} endpoint={`/api/s/${token}/preview`} agentScreen={`/api/s/${token}/agent-screen`} active={tab === "preview"} request={browserRequest} htmlFiles={htmlFiles} onNavigate={onBrowse} />
              </div>
            )}
            </div>
          </motion.aside>
        )}
        </AnimatePresence>

        <nav className={ui.rail} aria-label="Panels">
          {tabs.map((t) => (
            <button key={t.id} type="button" className={ui.railBtn} style={panelOpen && tab === t.id ? { color: "var(--w-accent-2)" } : undefined} onClick={() => choose(t.id)} aria-label={t.label} aria-pressed={panelOpen && tab === t.id} title={t.label} data-el={`rail-${t.id}`}>
              {panelOpen && tab === t.id && <TabIndicator id="rail-active" />}
              <span className={ui.tabLabel}>{t.icon}</span>
              {t.badge}
            </button>
          ))}
          <span className={ui.railSpacer} />
          <button type="button" className={ui.railBtn} onClick={() => setPanelOpen((v) => !v)} aria-label={panelOpen ? "Hide panel" : "Show panel"} title={`${panelOpen ? "Hide" : "Show"} panel (Cmd+B)`}>
            <SidebarSimple size={18} style={{ transform: "scaleX(-1)" }} weight={panelOpen ? "fill" : "regular"} />
          </button>
        </nav>
      </div>

      <footer className={ui.statusBar}>
        <span className={ui.statusItem}><span className={ui.dot} style={{ color: state.ai.active ? "var(--w-ok)" : "var(--w-fg-4)" }} />{state.ai.active ? "AI access on" : "AI access off"}</span>
        <span className={ui.statusItem}>Files save automatically</span>
        <span className={ui.statusItem} style={{ marginLeft: "auto" }}><Keys keys={["mod", "enter"]} /> run tests</span>
        <span className={ui.statusItem}><Keys keys={["mod", "B"]} /> toggle panel</span>
      </footer>

      {confirming && (
        <div className={ui.overlay} onClick={() => !submitting && setConfirming(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className={ui.modal} onClick={(e) => e.stopPropagation()}>
            <div id="confirm-title" className={ui.modalTitle}>{playground ? "End the playground?" : isLast ? "Submit and finish the session?" : `Submit challenge ${String(state.currentIndex + 1).padStart(2, "0")}?`}</div>
            <p className={ui.muted} style={{ marginTop: 8, lineHeight: 1.6 }}>
              {playground ? "The sandbox closes and its AI access turns off. Nothing here counts toward your interview, and you can't reopen it." : <>You can&apos;t come back to it. {isLast ? "This is the last one: AI access turns off and the session ends." : "The next challenge opens right away with the time you have left, and the agent starts fresh."}</>}
            </p>
            {testOut && testOut.total > 0 && (
              <div className={ui.callout} style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`${ui.chip} ${testOut.passed === testOut.total ? ui.chipOk : ui.chipWarn}`}>{testOut.passed}/{testOut.total}</span>
                <span className={ui.muted}>visible tests passing on your last run</span>
              </div>
            )}
            <div className={ui.modalActions}>
              <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => setConfirming(false)} disabled={submitting}>Keep working</button>
              <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => void submit()} disabled={submitting} autoFocus>{submitting ? (playground ? "Closing…" : "Submitting…") : playground ? "End playground" : "Submit"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </MotionConfig>
  );
}
