"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Select } from "@/components/select";
import { Segmented } from "@/components/segmented";
import { IconArrow, IconCheck, IconCopy } from "@/components/icons";
import { useI18n } from "@/components/i18n";
import { inviteMany, type InviteResult } from "./sessions/actions";

export type QuickSetup = { id: string; from: string; name: string; detail: string; challengeIds: string[]; minutes: number; budgetUsd: number; model: string };

export function QuickInvite({ setups }: { setups: QuickSetup[] }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(inviteMany, null);
  const [mode, setMode] = useState<"live" | "async">("live");
  const [setupId, setSetupId] = useState(setups[0]?.id ?? "");
  const [copied, setCopied] = useState<string | null>(null);
  const setup = setups.find((s) => s.id === setupId) ?? setups[0];
  return (
    <section data-el="quick-invite" className="queue">
      {!setup ? (
        <div style={{ padding: 20 }}>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>{t("quick.emptyText")}</p>
          <Link href="/sessions/new" className="btn" style={{ marginTop: 12 }}>{t("overview.inviteCandidate")}</Link>
        </div>
      ) : (
        <form action={action} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="hidden" name="mode" value={mode} />
          {setup.challengeIds.map((id) => <input key={id} type="hidden" name="challenge" value={id} />)}
          <input type="hidden" name="minutes" value={setup.minutes} />
          <input type="hidden" name="budget" value={setup.budgetUsd} />
          <input type="hidden" name="model" value={setup.model} />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr) auto auto", gap: 10, alignItems: "center" }}>
            <input className="input" name="emails" type="email" required placeholder={t("quick.emailPlaceholder")} aria-label={t("quick.emailLabel")} />
            <Select ariaLabel={t("quick.setupLabel")} value={setup.id} onChange={setSetupId} options={setups.map((s) => ({ value: s.id, label: s.name, text: s.name, hint: s.detail }))} />
            <div data-el="invite-mode"><Segmented ariaLabel={t("quick.formatLabel")} value={mode} onChange={setMode} options={[{ value: "live", label: t("quick.formatLive") }, { value: "async", label: t("quick.formatAsync") }]} /></div>
            <button data-el="quick-send" className="btn btn-white" disabled={pending}>{pending ? t("quick.sending") : t("quick.send")}</button>
          </div>
          <div className="faint" style={{ fontSize: 12.5 }}>{setup.detail}</div>
          {state && !state.ok && <div className="notice notice-err" role="alert">{state.error}</div>}
          {state?.ok && (
            <div data-el="quick-links" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {state.links.map((l) => (
                <div key={l.url} className="notice notice-accent" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "var(--text)", fontWeight: 600 }}>{t(l.mailed ? "quick.emailed" : "quick.notEmailed", { email: l.email })}</div>
                    <div className="mono truncate" style={{ fontSize: 12, marginTop: 4 }} data-testid="invite-link">{l.url}</div>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => { void navigator.clipboard.writeText(l.url); setCopied(l.url); }}>{copied === l.url ? <IconCheck size={12} /> : <IconCopy size={12} />}{copied === l.url ? t("common.copied") : t("quick.copyLink")}</button>
                </div>
              ))}
            </div>
          )}
        </form>
      )}
      <div className="card-foot">
        <Link data-el="more-options" href={setup ? `/sessions/new?from=${setup.from}` : "/sessions/new"} className="faint hover:!text-[var(--text-2)]" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>{t("quick.moreOptions")}<IconArrow size={13} /></Link>
      </div>
    </section>
  );
}
