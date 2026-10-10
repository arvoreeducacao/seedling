"use client";

import { createRef, useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import type { AgentState } from "@/components/brand";
import { useI18n } from "@/components/i18n";
import type { Key, T } from "@/lib/i18n";
import { AgentSession } from "./agent-session";
import type { TerminalHandle } from "./terminal";
import ui from "./ui.module.css";
import { SetupIndicator } from "@/components/setup/setup-indicator";

export type AgentTab = { key: string; name: string; createdAt: string | null; closedAt: string | null; mergedAt: string | null; status?: "working" | "waiting" | "idle" | "closed" };

const activityKey: Record<AgentState, Key> = { working: "workspace.activityWorking", done: "workspace.activityDone", idle: "workspace.activityIdle", error: "workspace.activityError" };

function agentName(t: T, agent: AgentTab) {
  return agent.key === "main" ? t("workspace.agentMain") : agent.name;
}

function tabState(local: AgentState | undefined, server: AgentTab["status"]): AgentState {
  if (local === "error") return "error";
  if (server === "working") return "working";
  if (server === "waiting") return "done";
  return "idle";
}

export function AgentDeck({
  token,
  sessionId,
  challengeIndex,
  generation,
  model,
  aiActive,
  aiReason,
  agents,
  max,
  active,
  onSelect,
  onChanged,
}: {
  token: string;
  sessionId: string;
  challengeIndex: number;
  generation: number;
  model: string;
  aiActive: boolean;
  aiReason: string | null;
  agents: AgentTab[];
  max: number;
  active: string;
  onSelect: (key: string) => void;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const handles = useRef(new Map<string, React.RefObject<TerminalHandle | null>>());
  const [activity, setActivity] = useState<Record<string, AgentState>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [closing, setClosing] = useState<AgentTab | null>(null);
  const open = agents.filter((a) => !a.closedAt);
  const multi = open.length > 1;

  const handleFor = (key: string) => {
    let ref = handles.current.get(key);
    if (!ref) {
      ref = createRef<TerminalHandle | null>();
      handles.current.set(key, ref);
    }
    return ref;
  };

  const onActivity = useCallback((key: string, state: AgentState) => setActivity((all) => (all[key] === state ? all : { ...all, [key]: state })), []);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/s/${token}/agents`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) {
      setError(json?.error ?? t("workspace.openAgentFailed"));
      return;
    }
    await onChanged();
    onSelect(json.agent.key);
  }

  async function rename(key: string, name: string) {
    setRenaming(null);
    const current = agents.find((a) => a.key === key);
    if (!current || !name.trim() || name.trim() === current.name) return;
    await fetch(`/api/s/${token}/agents/${key}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    await onChanged();
  }

  async function close(agent: AgentTab) {
    setBusy(true);
    const res = await fetch(`/api/s/${token}/agents/${agent.key}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    setClosing(null);
    if (!res?.ok) {
      setError(t("workspace.closeAgentFailed"));
      return;
    }
    if (active === agent.key) onSelect("main");
    await onChanged();
  }

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.altKey) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && open[index]) {
        e.preventDefault();
        onSelect(open[index].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onSelect]);

  return (
    <section className={ui.agent} aria-label={t("workspace.agentsLabel")}>
      <div className={ui.agentTabs} role="tablist" aria-label={t("workspace.agentsLabel")} data-el="agent-tabs">
        <AnimatePresence initial={false}>
          {open.map((agent, i) => {
            const state = tabState(activity[agent.key], agent.status);
            const selected = agent.key === active;
            return (
              <motion.div key={agent.key} layout="position" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.16 }} className={`${ui.agentTab} ${selected ? ui.agentTabActive : ""}`} data-el="agent-tab" data-agent={agent.key}>
                {renaming === agent.key ? (
                  <input
                    className={ui.agentTabInput}
                    defaultValue={agent.name}
                    autoFocus
                    maxLength={40}
                    aria-label={t("workspace.agentNameLabel")}
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={(e) => void rename(agent.key, e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={ui.agentTabMain}
                    onClick={() => onSelect(agent.key)}
                    onDoubleClick={() => agent.key !== "main" && setRenaming(agent.key)}
                    title={[t("workspace.agentTabTitle", { name: agentName(t, agent), activity: t(activityKey[state]) }), agent.key !== "main" ? t("workspace.renameHint") : "", i < 9 ? `${navigator.platform.includes("Mac") ? "⌥⌘" : "Ctrl+Alt+"}${i + 1}` : ""].filter(Boolean).join(" · ")}
                  >
                    <span className={ui.agentDot} data-state={state} aria-hidden="true" />
                    <span className={ui.ellipsis}>{agentName(t, agent)}</span>
                    {multi && state === "done" && !selected && <span className={ui.agentWaiting}>{t("workspace.waiting")}</span>}
                  </button>
                )}
                {agent.key !== "main" && (
                  <button type="button" className={ui.fileTabClose} onClick={() => setClosing(agent)} aria-label={t("workspace.closeNamed", { name: agent.name })} title={t("workspace.closeNamed", { name: agent.name })}><X size={11} /></button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm} ${ui.agentNew}`} onClick={() => void create()} disabled={busy || open.length >= max || !aiActive} title={open.length >= max ? t("workspace.agentMaxHint", { max }) : t("workspace.newAgentHint")} data-el="new-agent">
          <Plus size={12} weight="bold" /> {t("workspace.newAgent")}
        </button>
        <span className={ui.agentCount}>{open.length}/{max}</span>
        <SetupIndicator token={token} />
      </div>
      <AnimatePresence>
        {error && (
          <motion.div key="error" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", flex: "none" }}>
            <div className={`${ui.banner} ${ui.bannerWarn}`} role="alert"><span className={ui.dot} style={{ color: "var(--w-warn)" }} /><span style={{ flex: 1 }}>{error}</span></div>
          </motion.div>
        )}
      </AnimatePresence>
      {open.map((agent) => (
        <AgentSession
          key={agent.key}
          sessionId={sessionId}
          agent={agent.key}
          visible={agent.key === active}
          challengeIndex={challengeIndex}
          generation={generation}
          model={model}
          aiActive={aiActive}
          aiReason={aiReason}
          handle={handleFor(agent.key)}
          onActivity={onActivity}
        />
      ))}
      {closing && (
        <div className={ui.overlay} onClick={() => !busy && setClosing(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="close-agent-title" className={ui.modal} onClick={(e) => e.stopPropagation()}>
            <div id="close-agent-title" className={ui.modalTitle}>{t("workspace.closeAgentTitle", { name: closing.name })}</div>
            <p className={ui.muted} style={{ marginTop: 8, lineHeight: 1.6 }}>
              {t("workspace.closeAgentText")} {t(closing.mergedAt ? "workspace.closeAgentMerged" : "workspace.closeAgentUnmerged")}
            </p>
            <div className={ui.modalActions}>
              <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => setClosing(null)} disabled={busy}>{t("workspace.keepIt")}</button>
              <button type="button" className={`${ui.btn} ${ui.btnDanger}`} onClick={() => void close(closing)} disabled={busy} autoFocus>{t(busy ? "workspace.closing" : "workspace.closeAgent")}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
