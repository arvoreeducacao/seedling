"use client";

import { useActionState, useState } from "react";
import { IconCheck, IconCopy } from "@/components/icons";
import { useI18n } from "@/components/i18n";
import { inviteAdmin, type AdminInviteResult } from "./actions";

function LinkNotice({ state }: { state: Extract<AdminInviteResult, { ok: true }> }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="notice notice-accent" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--text)", fontWeight: 600 }}>{t("settings.admins.linkNotice", { email: state.email })}</div>
        <div className="mono truncate" style={{ fontSize: 12, marginTop: 4 }} data-testid="admin-invite-link">{state.url}</div>
      </div>
      <button type="button" className="btn btn-sm" style={{ flex: "none" }} onClick={() => { void navigator.clipboard.writeText(state.url); setCopied(true); }}>{copied ? <IconCheck size={12} /> : <IconCopy size={12} />}{copied ? t("common.copied") : t("settings.admins.copyLink")}</button>
    </div>
  );
}

export function AdminRow({ email, hasAccount, badge, actions }: { email: string; hasAccount: boolean; badge?: React.ReactNode; actions?: React.ReactNode }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AdminInviteResult | null, FormData>(inviteAdmin, null);
  return (
    <div className="list-item" style={{ minHeight: 44, flexWrap: "wrap", rowGap: 10 }}>
      <span className="muted truncate" style={{ flex: 1, minWidth: 0 }}>{email}</span>
      {!hasAccount && <span className="pill pill-ghost" style={{ flex: "none" }}>{t("settings.admins.noAccount")}</span>}
      {!hasAccount && (
        <form action={action} style={{ flex: "none" }}>
          <input type="hidden" name="email" value={email} />
          <button className="btn btn-ghost btn-sm" disabled={pending}>{pending ? t("settings.admins.creating") : t("settings.admins.inviteLink")}</button>
        </form>
      )}
      {badge}
      {actions}
      {state && !state.ok && <div className="notice notice-err" role="alert" style={{ width: "100%" }}>{state.error}</div>}
      {state?.ok && <LinkNotice state={state} />}
    </div>
  );
}

export function InviteAdmin() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AdminInviteResult | null, FormData>(inviteAdmin, null);
  return (
    <form action={action} className="card-foot" style={{ marginTop: "auto", flexDirection: "column", alignItems: "stretch", gap: 10 }} data-el="invite-admin">
      <div style={{ display: "flex", gap: 8 }}>
        <input className="input" name="email" type="email" placeholder={t("settings.admins.emailPlaceholder")} aria-label={t("settings.admins.emailLabel")} required style={{ flex: 1 }} />
        <button className="btn" disabled={pending}>{pending ? t("settings.admins.adding") : t("settings.admins.add")}</button>
      </div>
      {state && !state.ok && <div className="notice notice-err" role="alert">{state.error}</div>}
      {state?.ok && <LinkNotice state={state} />}
    </form>
  );
}
