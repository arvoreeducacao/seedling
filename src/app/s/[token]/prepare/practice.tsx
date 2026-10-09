"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowSquareOut, Flask } from "@phosphor-icons/react";
import ui from "@/components/workspace/ui.module.css";
import { AgentBuddy, Stopwatch } from "@/components/brand";
import prep from "../prep.module.css";
import { prepFetch } from "./client";

export type PracticeStatus = {
  status: "none" | "running" | "submitted" | "expired" | "cancelled" | "invited" | "paused";
  remainingMs?: number;
  spent?: number;
  budget?: number;
  minutesUsed?: number;
  prompts?: number;
  url?: string | null;
};

export type PracticeOffer = { mode: "playground" | "challenge"; minutes: number; budgetUsd: number; title: string | null; kind: "code" | "screen" | null; runtime: string | null };

export function usePracticeStatus(token: string, enabled: boolean) {
  const [status, setStatus] = useState<PracticeStatus | null>(null);
  const refresh = useCallback(() => prepFetch<PracticeStatus>(token, "practice").then(setStatus).catch(() => {}), [token]);
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 15_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, enabled]);
  return { status, refresh };
}

export function practiceUsed(status: PracticeStatus | null) {
  return Boolean(status && status.status !== "none" && status.status !== "cancelled");
}

export function Practice({ token, offer, status, refresh }: { token: string; offer: PracticeOffer; status: PracticeStatus | null; refresh: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setPending(true);
    setError(null);
    const tab = window.open("about:blank", "_blank");
    try {
      const { url } = await prepFetch<{ url: string }>(token, "practice", { method: "POST" });
      if (tab) tab.location.href = url;
      else window.location.href = url;
      void refresh();
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "Couldn't start the practice run.");
    } finally {
      setPending(false);
    }
  }
  const playground = offer.mode === "playground";
  const running = status?.status === "running";
  const used = practiceUsed(status) && !running;
  const left = running && status?.remainingMs ? Math.ceil(status.remainingMs / 60_000) : null;
  return (
    <div className={`${prep.panel} ${prep.practice}`} data-el={playground ? "playground" : "practice"}>
      <div className={prep.panelHead}>
        <span className={prep.practiceTag}><Flask size={12} weight="fill" /> {playground ? "Playground · not graded" : "Practice · doesn't count"}</span>
      </div>
      <div className={prep.practiceBody}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className={prep.panelTitle}>{playground ? "A sandbox that's all yours" : "Warm up in a real sandbox"}</h3>
          <p className={prep.panelText}>
            {playground
              ? "Same setup as the interview: a terminal with Claude Code already running, the files and a browser. Inside there's a short README and a tiny sample project with one failing test, so you have something to poke at. Explore, break things, try your skills."
              : "Same setup as the interview: a terminal, the files and Claude Code. Try your skills and MCP servers, get used to the layout, then close the tab. Nobody grades it."}
          </p>
        </div>
        {running ? <Stopwatch progress={status?.remainingMs ? status.remainingMs / (offer.minutes * 60_000) : 1} running size={56} /> : <AgentBuddy state={used ? "done" : "idle"} size={64} />}
      </div>
      <dl className={prep.practiceFacts}>
        {playground ? (
          <>
            <div><dt>Inside</dt><dd>Sample project</dd></div>
            <div><dt>Your setup</dt><dd>Installed</dd></div>
          </>
        ) : (
          <>
            <div><dt>Challenge</dt><dd>{offer.title}</dd></div>
            <div><dt>Kind</dt><dd>{offer.kind === "screen" ? "UI" : "Code"} · {offer.runtime}</dd></div>
          </>
        )}
        <div><dt>Time</dt><dd>{offer.minutes} min</dd></div>
        <div><dt>AI budget</dt><dd>${offer.budgetUsd.toFixed(2)}, its own</dd></div>
      </dl>
      {error && <div className={prep.error} role="alert">{error}</div>}
      <div className={prep.practiceFoot}>
        {running && status?.url ? (
          <a href={status.url} target="_blank" rel="noreferrer" className={`${ui.btn} ${ui.btnPrimary}`} data-el="open-practice">{playground ? "Open the playground" : "Open the practice run"} <ArrowSquareOut size={13} /></a>
        ) : (
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => void start()} disabled={pending || used || status === null} data-el="start-practice">
            {pending ? <><span className={ui.spinner} style={{ width: 12, height: 12, borderTopColor: "#fff" }} /> Starting…</> : used ? (playground ? "Playground used" : "Practice used") : playground ? "Open the playground" : "Start practice"}
          </button>
        )}
        <span className={ui.faint} style={{ fontSize: 11.5 }} data-el="practice-status">
          {running
            ? `${left ?? 0} min left · $${(status?.spent ?? 0).toFixed(2)} of $${(status?.budget ?? offer.budgetUsd).toFixed(2)} used`
            : used
              ? `Done: ${status?.minutesUsed ?? 0} min, ${status?.prompts ?? 0} prompt${status?.prompts === 1 ? "" : "s"}. You get one run.`
              : "One run. It opens in a new tab and the clock starts then."}
        </span>
      </div>
    </div>
  );
}
