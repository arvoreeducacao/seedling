import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { enabledProviders } from "@/lib/better-auth";
import { mailConfigured } from "@/lib/mail";
import { sandbox } from "@/lib/sandbox";
import { displayName, when } from "@/lib/format";
import { IconArrow } from "@/components/icons";
import { addAdmin, dismissRequest, removeAdmin } from "./actions";
import { AdminRow, InviteAdmin } from "./invite-admin";
import Link from "next/link";
import { kitUpdatedAt, loadKit } from "@/lib/prep";

export const metadata: Metadata = { title: "Settings" };

function Row({ label, value, ok }: { label: React.ReactNode; value: React.ReactNode; ok?: boolean }) {
  return (
    <div className="list-item" style={{ minHeight: 44 }}>
      <span className="muted" style={{ flex: "none" }}>{label}</span>
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, minWidth: 0, textAlign: "right" }}>
        <span className="truncate">{value}</span>
        {ok !== undefined && <span className="dot" style={{ background: ok ? "var(--ok)" : "var(--warn)" }} />}
      </span>
    </div>
  );
}

function Env({ name }: { name: string }) {
  return <span className="pill pill-ghost mono" style={{ height: 18, fontSize: 10.5, marginLeft: 8 }}>{name}</span>;
}

export default async function SettingsPage() {
  const [admins, requests, log, docker, accounts, kit, kitSaved] = await Promise.all([
    db.query.admins.findMany(),
    db.query.accessRequests.findMany({ orderBy: desc(schema.accessRequests.createdAt) }),
    db.query.auditLog.findMany({ orderBy: desc(schema.auditLog.createdAt), limit: 40 }),
    Promise.resolve().then(() => sandbox().available()).catch((e: unknown) => ({ ok: false, detail: e instanceof Error ? e.message : "Unavailable" })),
    db.query.authUser.findMany({ columns: { email: true } }),
    loadKit(),
    kitUpdatedAt(),
  ]);
  const practiceChallenge = kit.practice.challengeId ? await db.query.challenges.findFirst({ where: (c, { eq }) => eq(c.id, kit.practice.challengeId!), columns: { title: true } }) : null;
  const brings = ([["skills", "Skills"], ["claudeMd", "CLAUDE.md"], ["mcpServers", "MCP servers"]] as const).filter(([k]) => kit.bring[k]).map(([, label]) => label);
  const users = new Set(accounts.map((u) => u.email.toLowerCase()));
  const providers = enabledProviders();
  return (
    <>
      <PageHeader title="Settings" sub="Read from the server's environment variables" />
      <div className="page" style={{ display: "flex", flexDirection: "column", gap: 24,  }}>
        {requests.length > 0 && (
          <section className="card" data-el="access-requests">
            <div className="card-head">Access requests<span className="count">{requests.length}</span></div>
            {requests.map((r) => (
              <div key={r.id} className="list-item">
                <span style={{ fontWeight: 500 }}>{r.email}</span><span className="faint">{when(r.createdAt)}</span>
                <form action={addAdmin} style={{ marginLeft: "auto" }}><input type="hidden" name="email" value={r.email} /><button className="btn btn-sm btn-primary">Make admin</button></form>
                <form action={dismissRequest.bind(null, r.id)}><button className="btn btn-ghost btn-sm">Dismiss</button></form>
              </div>
            ))}
          </section>
        )}

        <section className="card" id="prep" data-el="prep-kit">
          <div className="card-head">Candidate prep<span className="aside">what candidates see before they press Start</span></div>
          <Row label="Kit" value={<>{kit.name || "Untitled kit"}{!kitSaved && <span className="pill pill-ghost" style={{ marginLeft: 8 }}>Default</span>}</>} />
          <Row label="Sections" value={<span className="num">{kit.sections.length} section{kit.sections.length === 1 ? "" : "s"} · {kit.sections.reduce((n, s) => n + s.links.length, 0)} links</span>} />
          <Row label="Opens" value={`${kit.opensDaysBefore} day${kit.opensDaysBefore === 1 ? "" : "s"} before the interview`} />
          <Row label="Practice run" value={kit.practice.enabled && practiceChallenge ? `${practiceChallenge.title} · ${kit.practice.minutes} min · $${kit.practice.budgetUsd.toFixed(2)}` : "Off"} ok={kit.practice.enabled && Boolean(practiceChallenge)} />
          <Row label="Candidates may bring" value={brings.length ? brings.join(", ") : "Nothing"} />
          <div className="card-foot" style={{ gap: 8 }}>
            <Link href="/settings/prep" className="btn btn-primary btn-sm" data-el="edit-prep">Edit kit</Link>
            <a href="/api/admin/prep/export" className="btn btn-ghost btn-sm" download>Export JSON</a>
            <span className="faint" style={{ marginLeft: "auto", fontSize: 12 }}>{kitSaved ? `Saved ${when(kitSaved.updatedAt)}` : "Import your own from Edit kit"}</span>
          </div>
        </section>

        <section className="card" data-el="key-path">
          <div className="card-head">How the AI key is protected<span className="aside">the real key never leaves the gateway</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", alignItems: "center", gap: 12, padding: "20px 16px" }}>
            {[
              ["Candidate sandbox", "holds a per-session pass that expires with it", false],
              ["Seedling gateway", "enforces budget, logs every call, can cut access", true],
              ["Anthropic", "receives the real API key", false],
            ].map(([title, text, on], i) => (
              <div key={String(title)} style={{ display: "contents" }}>
                {i > 0 && <span className="faint" aria-hidden="true" style={{ display: "flex" }}><IconArrow size={16} /></span>}
                <div style={{ padding: "12px 14px", borderRadius: "var(--r)", border: `1px solid ${on ? "rgba(124,108,255,.45)" : "var(--border-strong)"}`, background: on ? "var(--accent-soft)" : "var(--bg-raised)" }}>
                  <div style={{ fontWeight: 500, color: on ? "var(--accent-text)" : undefined }}>{title}</div>
                  <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 24 }}>
          <section className="card" id="providers">
            <div className="card-head">AI provider</div>
            <Row label={<>Anthropic<Env name="ANTHROPIC_API_KEY" /></>} value={<span style={{ color: env.anthropicKey ? "var(--ok)" : "var(--warn)" }}>{env.anthropicKey ? "Connected" : "No key"}</span>} ok={Boolean(env.anthropicKey)} />
            <Row label="Upstream" value={<span className="mono" style={{ fontSize: 12 }}>{env.anthropicUpstream}</span>} />
            <Row label="Monthly org cap" value={<span className="num">${env.monthlyBudgetUsd}</span>} />
          </section>
          <section className="card" id="sandboxes">
            <div className="card-head">Sandboxes</div>
            <Row label="Driver" value={<span className="mono">{env.sandbox.driver}</span>} ok={docker.ok} />
            <Row label="Status" value={docker.detail} />
            <Row label="Isolation" value={process.env.SEEDLING_SANDBOX_RUNTIME ? <span className="mono">{process.env.SEEDLING_SANDBOX_RUNTIME}</span> : "Default container runtime"} ok={Boolean(process.env.SEEDLING_SANDBOX_RUNTIME)} />
            <Row label="Per session" value={<span className="num">{env.sandbox.cpus} CPU · {env.sandbox.memoryMb} MB · {env.sandbox.pids} processes</span>} />
            <Row label="Concurrent sessions" value={<span className="num">up to {env.sandbox.maxConcurrent}</span>} />
            <Row label="Network" value={env.sandbox.network ? <span className="mono">{env.sandbox.network}</span> : "Docker default"} ok={Boolean(env.sandbox.network)} />
          </section>
          <section className="card" id="auth">
            <div className="card-head">Sign-in and email</div>
            <Row label="Sign-in methods" value={["Email and password", providers.google && "Google", providers.github && "GitHub"].filter(Boolean).join(", ")} ok />
            <Row label="Allowed domains" value={env.allowedDomains.length ? env.allowedDomains.join(", ") : "Any"} />
            <Row label="Invite emails" value={mailConfigured() ? "SMTP configured" : "No SMTP: links are shown to copy"} ok={mailConfigured()} />
            <Row label="New interviewer accounts" value={mailConfigured() ? "Email confirmation required" : "Only through an invite link"} ok />
          </section>
          <section className="card" id="admins" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-head">Admins<span className="count">{env.adminEmails.length + admins.length}</span></div>
            {env.adminEmails.length + admins.length === 0 && <div className="list-item faint">No admins yet. Add the first one below.</div>}
            {env.adminEmails.map((e) => <AdminRow key={e} email={e} hasAccount={users.has(e)} badge={<span className="pill" style={{ flex: "none" }}>From env</span>} />)}
            {admins.filter((a) => !env.adminEmails.includes(a.email)).map((a) => (
              <AdminRow key={a.email} email={a.email} hasAccount={users.has(a.email)} actions={<form action={removeAdmin.bind(null, a.email)} style={{ flex: "none" }}><button className="btn btn-ghost btn-sm">Remove</button></form>} />
            ))}
            <InviteAdmin />
          </section>
        </div>

        <section className="card" data-el="audit-log">
          <div className="card-head">Audit log<span className="aside">append-only record of who did what</span></div>
          {log.length === 0 && <div className="list-item faint">Nothing recorded yet.</div>}
          {log.map((l) => (
            <div key={l.id} className="row" style={{ gridTemplateColumns: "110px minmax(0,1fr) minmax(0,1.2fr) minmax(0,1fr) 120px", gap: 16, fontSize: 12, padding: "10px 16px" }}>
              <span className="faint num">{when(l.createdAt)}</span>
              <span className="truncate">{displayName(l.actor)}</span>
              <span className="muted truncate">{l.action}</span>
              <span className="faint mono truncate" style={{ fontSize: 11.5 }}>{l.target}</span>
              <span className="faint mono truncate" style={{ textAlign: "right", fontSize: 11.5 }}>{l.ip}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
