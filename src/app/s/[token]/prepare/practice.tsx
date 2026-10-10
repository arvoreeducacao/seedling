"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowSquareOut, Flask } from "@phosphor-icons/react";
import ui from "@/components/workspace/ui.module.css";
import { AgentBuddy, Stopwatch } from "@/components/brand";
import { useI18n } from "@/components/i18n";
import { money } from "@/lib/format";
import prep from "../prep.module.css";
import { prepError, prepFetch } from "./client";

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
  const i18n = useI18n();
  const { t } = i18n;
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
      setError(prepError(e, t, "prep.practice.startFailed"));
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
        <span className={prep.practiceTag}><Flask size={12} weight="fill" /> {playground ? t("prep.practice.tagPlayground") : t("prep.practice.tagPractice")}</span>
      </div>
      <div className={prep.practiceBody}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className={prep.panelTitle}>{playground ? t("prep.practice.panelPlayground") : t("prep.practice.panelPractice")}</h3>
          <p className={prep.panelText}>{playground ? t("prep.practice.bodyPlayground") : t("prep.practice.bodyPractice")}</p>
        </div>
        {running ? <Stopwatch progress={status?.remainingMs ? status.remainingMs / (offer.minutes * 60_000) : 1} running size={56} /> : <AgentBuddy state={used ? "done" : "idle"} size={64} />}
      </div>
      <dl className={prep.practiceFacts}>
        {playground ? (
          <>
            <div><dt>{t("prep.practice.inside")}</dt><dd>{t("prep.practice.insideValue")}</dd></div>
            <div><dt>{t("prep.practice.yourSetup")}</dt><dd>{t("prep.practice.yourSetupValue")}</dd></div>
          </>
        ) : (
          <>
            <div><dt>{t("prep.practice.challenge")}</dt><dd>{offer.title}</dd></div>
            <div><dt>{t("prep.practice.kind")}</dt><dd>{offer.kind === "screen" ? t("prep.ui") : t("kind.code.title")} · {offer.runtime}</dd></div>
          </>
        )}
        <div><dt>{t("prep.practice.time")}</dt><dd>{offer.minutes} {t("common.minutes")}</dd></div>
        <div><dt>{t("prep.practice.budget")}</dt><dd>{t("prep.practice.budgetValue", { amount: money(i18n, offer.budgetUsd) })}</dd></div>
      </dl>
      {error && <div className={prep.error} role="alert">{error}</div>}
      <div className={prep.practiceFoot}>
        {running && status?.url ? (
          <a href={status.url} target="_blank" rel="noreferrer" className={`${ui.btn} ${ui.btnPrimary}`} data-el="open-practice">{playground ? t("prep.practice.openPlayground") : t("prep.practice.openPractice")} <ArrowSquareOut size={13} /></a>
        ) : (
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => void start()} disabled={pending || used || status === null} data-el="start-practice">
            {pending ? <><span className={ui.spinner} style={{ width: 12, height: 12, borderTopColor: "#fff" }} /> {t("prep.practice.starting")}</> : used ? (playground ? t("prep.practice.playgroundUsed") : t("prep.practice.practiceUsed")) : playground ? t("prep.practice.openPlayground") : t("prep.practice.startPractice")}
          </button>
        )}
        <span className={ui.faint} style={{ fontSize: 11.5 }} data-el="practice-status">
          {running
            ? t("prep.practice.running", { minutes: left ?? 0, spent: money(i18n, status?.spent ?? 0), budget: money(i18n, status?.budget ?? offer.budgetUsd) })
            : used
              ? t("prep.practice.used", { minutes: status?.minutesUsed ?? 0, n: status?.prompts ?? 0 })
              : t("prep.practice.oneRun")}
        </span>
      </div>
    </div>
  );
}
