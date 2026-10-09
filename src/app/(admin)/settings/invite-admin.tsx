"use client";

import { useActionState, useState } from "react";
import { IconCheck, IconCopy } from "@/components/icons";
import { inviteAdmin, type AdminInviteResult } from "./actions";

function LinkNotice({ state }: { state: Extract<AdminInviteResult, { ok: true }> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="notice notice-accent" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--text)", fontWeight: 600 }}>Send this link to {state.email}. It works once, for 7 days, and is shown only now.</div>
        <div className="mono truncate" style={{ fontSize: 12, marginTop: 4 }} data-testid="admin-invite-link">{state.url}</div>
      </div>
      <button type="button" className="btn btn-sm" style={{ flex: "none" }} onClick={() => { void navigator.clipboard.writeText(state.url); setCopied(true); }}>{copied ? <IconCheck size={12} /> : <IconCopy size={12} />}{copied ? "Copied" : "Copy link"}</button>
    </div>
  );
}

export function AdminRow({ email, hasAccount, badge, actions }: { email: string; hasAccount: boolean; badge?: React.ReactNode; actions?: React.ReactNode }) {
  const [state, action, pending] = useActionState<AdminInviteResult | null, FormData>(inviteAdmin, null);
  return (
    <div className="list-item" style={{ minHeight: 44, flexWrap: "wrap", rowGap: 10 }}>
      <span className="muted truncate" style={{ flex: 1, minWidth: 0 }}>{email}</span>
      {!hasAccount && <span className="pill pill-ghost" style={{ flex: "none" }}>No account yet</span>}
      {!hasAccount && (
        <form action={action} style={{ flex: "none" }}>
          <input type="hidden" name="email" value={email} />
          <button className="btn btn-ghost btn-sm" disabled={pending}>{pending ? "Creating…" : "Invite link"}</button>
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
  const [state, action, pending] = useActionState<AdminInviteResult | null, FormData>(inviteAdmin, null);
  return (
    <form action={action} className="card-foot" style={{ marginTop: "auto", flexDirection: "column", alignItems: "stretch", gap: 10 }} data-el="invite-admin">
      <div style={{ display: "flex", gap: 8 }}>
        <input className="input" name="email" type="email" placeholder="teammate@company.com" aria-label="Admin email" required style={{ flex: 1 }} />
        <button className="btn" disabled={pending}>{pending ? "Adding…" : "Add admin"}</button>
      </div>
      {state && !state.ok && <div className="notice notice-err" role="alert">{state.error}</div>}
      {state?.ok && <LinkNotice state={state} />}
    </form>
  );
}
