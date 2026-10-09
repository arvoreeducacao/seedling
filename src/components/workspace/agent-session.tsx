"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";
import { TerminalView, type TerminalHandle, type TerminalStatus } from "./terminal";
import { AnimatePresence, motion } from "motion/react";
import { TaskRow, type TaskStatus } from "./ai";
import { AgentBuddy, Sprout, type AgentState } from "@/components/brand";
import ui from "./ui.module.css";

const LAUNCH = "claude\r";

function launchedKey(sessionId: string, index: number, agent: string) {
  return agent === "main" ? `seedling:agent:${sessionId}:${index}` : `seedling:agent:${sessionId}:${index}:${agent}`;
}

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {}
}

export function AgentSession({ sessionId, agent = "main", visible = true, challengeIndex, generation, model, aiActive, aiReason, handle, onActivity }: { sessionId: string; agent?: string; visible?: boolean; challengeIndex: number; generation: number; model: string; aiActive: boolean; aiReason: string | null; handle: React.RefObject<TerminalHandle | null>; onActivity?: (agent: string, state: AgentState) => void }) {
  const [status, setStatus] = useState<TerminalStatus>("connecting");
  const [phase, setPhase] = useState<"connecting" | "shell" | "agent" | "ready" | "failed">("connecting");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launched = useRef(false);
  const live = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = launchedKey(sessionId, challengeIndex, agent);
  const launchRef = useRef<() => void>(() => {});

  useEffect(() => {
    setPhase("connecting");
    const safety = setTimeout(() => setPhase((p) => (p === "failed" ? p : "ready")), 15000);
    return () => clearTimeout(safety);
  }, [generation]);

  useEffect(() => {
    launched.current = readFlag(key);
    if (!launched.current && live.current) {
      if (fallback.current) clearTimeout(fallback.current);
      fallback.current = setTimeout(() => launchRef.current(), 1500);
    }
    return () => {
      if (fallback.current) clearTimeout(fallback.current);
    };
  }, [key, generation]);

  const launch = useCallback(() => {
    if (!aiActive && !launched.current) setPhase((p) => (p === "failed" ? p : "ready"));
    if (launched.current || !aiActive) return;
    launched.current = true;
    writeFlag(key);
    handle.current?.syncSize();
    setPhase((p) => (p === "failed" ? p : "agent"));
    setTimeout(() => {
      handle.current?.syncSize();
      setTimeout(() => {
        if (readyTimer.current) clearTimeout(readyTimer.current);
        readyTimer.current = setTimeout(() => setPhase((p) => (p === "failed" ? p : "ready")), 5000);
        handle.current?.send(LAUNCH);
        handle.current?.focus();
      }, 150);
    }, 450);
  }, [aiActive, handle, key]);
  launchRef.current = launch;

  const onStatus = useCallback(
    (next: TerminalStatus) => {
      setStatus(next);
      live.current = next === "live";
      if (next === "live") {
        setPhase((p) => (p === "connecting" ? "shell" : p));
        if (launched.current) setTimeout(() => setPhase((p) => (p === "failed" ? p : "ready")), 1200);
      }
      if (next === "live" && !launched.current) {
        if (fallback.current) clearTimeout(fallback.current);
        fallback.current = setTimeout(launch, 2500);
      }
    },
    [launch],
  );

  const onOutput = useCallback(
    (text: string, sinceOpen: number) => {
      if (sinceOpen >= 400 && text.length > 3) lastOutput.current = Date.now();
      if (text.includes("sandbox is not running")) {
        setPhase("failed");
        return;
      }
      if (phaseRef.current === "agent" && /Claude Code|╭|>\s/.test(text)) {
        if (readyTimer.current) clearTimeout(readyTimer.current);
        readyTimer.current = setTimeout(() => setPhase("ready"), 300);
      }
      if (sinceOpen >= 400 && launched.current && phaseRef.current !== "agent" && phaseRef.current !== "failed") setPhase("ready");
      if (launched.current || sinceOpen < 400) return;
      if (fallback.current) clearTimeout(fallback.current);
      fallback.current = setTimeout(launch, 250);
    },
    [launch],
  );

  const [notice, setNotice] = useState<string | null>(null);
  const lastOutput = useRef(0);
  const [activity, setActivity] = useState<"idle" | "working" | "done">("idle");

  useEffect(() => {
    const timer = setInterval(() => {
      const since = Date.now() - lastOutput.current;
      setActivity((current) => (since < 1600 ? "working" : current === "working" ? "done" : current));
    }, 600);
    return () => clearInterval(timer);
  }, []);

  const buddy: AgentState = !aiActive || phase === "failed" ? "error" : phase !== "ready" ? "idle" : activity;
  const activityRef = useRef(onActivity);
  activityRef.current = onActivity;
  useEffect(() => {
    activityRef.current?.(agent, buddy);
  }, [agent, buddy]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      handle.current?.syncSize();
      handle.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, [visible, handle]);

  const onControl = useCallback(
    (message: string) => {
      if (!message.startsWith("fresh:")) return;
      if (!launched.current) return;
      setNotice(message === "fresh:revived" ? "Your sandbox restarted. Files are safe, the agent conversation started fresh." : "Your terminal reconnected to a new shell. Files are safe, the agent conversation started fresh.");
      setPhase((p) => (p === "failed" ? p : "agent"));
      const term = handle.current;
      setTimeout(() => term?.syncSize(), 200);
      setTimeout(() => {
        term?.syncSize();
        if (readyTimer.current) clearTimeout(readyTimer.current);
        readyTimer.current = setTimeout(() => setPhase((p) => (p === "failed" ? p : "ready")), 5000);
        if (aiActive) term?.send(`clear && ${LAUNCH}`);
        else setPhase("ready");
        term?.focus();
      }, 700);
    },
    [aiActive, handle],
  );

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 15000);
    return () => clearTimeout(timer);
  }, [notice]);

  function restart() {
    const term = handle.current;
    if (!term) return;
    launched.current = true;
    writeFlag(key);
    term.send("\u0003");
    setTimeout(() => term.send("\u0003"), 150);
    setTimeout(() => term.syncSize(), 450);
    setTimeout(() => {
      term.syncSize();
      term.send(`clear && ${LAUNCH}`);
      term.focus();
    }, 900);
  }

  return (
    <div className={ui.agentPane} style={visible ? undefined : { display: "none" }} data-el="agent-session" data-agent={agent} role="tabpanel" aria-label={`Agent session ${agent}`}>
      <div className={ui.agentBar}>
        <div className={ui.agentTitle}>
          <span className={ui.buddySlot}><AgentBuddy state={buddy} size={34} appear={false} label={`Agent ${buddy}`} /></span>
          Claude Code
        </div>
        <span className={`${ui.chip} ${ui.mono}`} title="Model routed through the interview gateway">{model}</span>
        <span className={`${ui.chip} ${status === "live" ? ui.chipOk : status === "offline" ? ui.chipWarn : ""}`} data-el="connection">
          <span className={ui.dot} />
          {status === "live" ? "Connected" : status === "offline" ? "Reconnecting" : "Connecting"}
        </span>
        <div className={ui.hints}>
          <span className={ui.hint}><span className={ui.kbd}>!</span> shell</span>
          <span className={ui.hint}><span className={ui.kbd}>/</span> commands</span>
          <span className={ui.hint}><span className={ui.kbd}>esc</span> interrupt</span>
        </div>
        <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} onClick={restart} disabled={status !== "live"} title="Exit the current agent and start a fresh one" data-el="restart-agent">
          <ArrowClockwise size={13} /> New session
        </button>
      </div>
      {!aiActive && (
        <div className={`${ui.banner} ${ui.bannerErr}`} role="status" data-el="ai-off">
          <span className={ui.dot} style={{ color: "var(--w-err)" }} />
          <span><b style={{ fontWeight: 600 }}>AI access is off.</b> <span className={ui.muted}>{aiReason ?? "The agent can no longer call the model."} The terminal still works.</span></span>
        </div>
      )}
      <AnimatePresence initial={false}>
        {notice && (
          <motion.div key="notice" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", flex: "none" }}>
            <div className={`${ui.banner} ${ui.bannerWarn}`} role="status" data-el="sandbox-restarted">
              <span className={ui.dot} style={{ color: "var(--w-warn)" }} />
              <span style={{ flex: 1 }}>{notice}</span>
              <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} onClick={() => setNotice(null)}>Got it</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={ui.termWrap} onClick={() => handle.current?.focus()}>
        <TerminalView sessionId={sessionId} agent={agent} generation={generation} handle={handle} onStatus={onStatus} onOutput={onOutput} onControl={onControl} fontSize={13.5} />
        <AnimatePresence>
          {phase !== "ready" && (
            <motion.div key="boot" className={ui.bootOverlay} initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.35 }} data-el="booting">
              <motion.div className={ui.bootCard} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Sprout mood={phase === "failed" ? "worried" : "thinking"} size={104} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "var(--w-head)" }}>{phase === "failed" ? "Your sandbox didn't start" : "Getting your sandbox ready"}</div>
                  <div className={ui.faint} style={{ marginTop: 4, fontSize: 12.5 }}>{phase === "failed" ? "Your files are safe. Reload in a few seconds, and tell your interviewer if it keeps happening." : "Claude Code opens here as soon as it's up."}</div>
                </div>
                {phase === "failed" ? (
                  <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => location.reload()}>Reload</button>
                ) : (
                  <div className={ui.bootTasks}>
                    <TaskRow status={stepStatus(phase, 0)} label="Connecting to the sandbox" />
                    <TaskRow status={stepStatus(phase, 1)} label="Opening a shell in /workspace" />
                    <TaskRow status={stepStatus(phase, 2)} label={aiActive ? "Starting Claude Code" : "AI access is off"} />
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const phases = ["connecting", "shell", "agent"] as const;

function stepStatus(phase: string, step: number): TaskStatus {
  const at = phases.indexOf(phase as (typeof phases)[number]);
  if (at > step) return "done";
  if (at === step) return "running";
  return "pending";
}
