import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { enabledProviders } from "@/lib/better-auth";
import { mailConfigured } from "@/lib/mail";
import { sandbox } from "@/lib/sandbox";
import { displayName, when } from "@/lib/format";
import { hasKey, type I18n } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { IconArrow } from "@/components/icons";
import { addAdmin, dismissRequest, removeAdmin } from "./actions";
import { AdminRow, InviteAdmin } from "./invite-admin";
import Link from "next/link";
import { kitUpdatedAt, loadKit } from "@/lib/prep";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("settings.title") };
}

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

function recorded({ t }: I18n, value: string | null) {
  if (!value) return "";
  return hasKey(value) ? t(value) : value;
}

export default async function SettingsPage() {
  const i18n = await getI18n();
  const { t } = i18n;
  const [admins, requests, log, docker, accounts, savedKit, kitSaved] = await Promise.all([
    db.query.admins.findMany(),
    db.query.accessRequests.findMany({ orderBy: desc(schema.accessRequests.createdAt) }),
    db.query.auditLog.findMany({ orderBy: desc(schema.auditLog.createdAt), limit: 40 }),
    Promise.resolve().then(() => sandbox().available()).catch((e: unknown) => ({ ok: false, detail: e instanceof Error ? e.message : t("settings.sandbox.unavailable") })),
    db.query.authUser.findMany({ columns: { email: true } }),
    loadKit(),
    kitUpdatedAt(),
  ]);
  const kit = savedKit;
  const practiceChallenge = kit.practice.challengeId ? await db.query.challenges.findFirst({ where: (c, { eq }) => eq(c.id, kit.practice.challengeId!), columns: { title: true } }) : null;
  const brings = (["skills", "claudeMd", "mcpServers"] as const).filter((k) => kit.bring[k]).map((k) => t(`kit.bring.${k}`));
  const users = new Set(accounts.map((u) => u.email.toLowerCase()));
  const providers = enabledProviders();
  return (
    <>
      <PageHeader title={t("settings.title")} sub={t("settings.sub")} />
      <div className="page" style={{ display: "flex", flexDirection: "column", gap: 24,  }}>
        {requests.length > 0 && (
          <section className="card" data-el="access-requests">
            <div className="card-head">{t("settings.requests.title")}<span className="count">{requests.length}</span></div>
            {requests.map((r) => (
              <div key={r.id} className="list-item">
                <span style={{ fontWeight: 500 }}>{r.email}</span><span className="faint">{when(i18n, r.createdAt)}</span>
                <form action={addAdmin} style={{ marginLeft: "auto" }}><input type="hidden" name="email" value={r.email} /><button className="btn btn-sm btn-primary">{t("settings.requests.makeAdmin")}</button></form>
                <form action={dismissRequest.bind(null, r.id)}><button className="btn btn-ghost btn-sm">{t("settings.requests.dismiss")}</button></form>
              </div>
            ))}
          </section>
        )}

        <section className="card" id="prep" data-el="prep-kit">
          <div className="card-head">{t("settings.prep.title")}<span className="aside">{t("settings.prep.aside")}</span></div>
          <Row label={t("settings.prep.kit")} value={<>{kit.name || t("settings.prep.untitled")}{!kitSaved && <span className="pill pill-ghost" style={{ marginLeft: 8 }}>{t("settings.prep.isDefault")}</span>}</>} />
          <Row label={t("settings.prep.sectionsLabel")} value={<span className="num">{t("settings.prep.sections", { n: kit.sections.length })} · {t("settings.prep.links", { n: kit.sections.reduce((n, s) => n + s.links.length, 0) })}</span>} />
          <Row label={t("settings.prep.opensLabel")} value={t("settings.prep.opens", { n: kit.opensDaysBefore })} />
          <Row label={t("settings.prep.practiceLabel")} value={kit.practice.enabled && practiceChallenge ? `${practiceChallenge.title} · ${kit.practice.minutes} ${t("common.minutes")} · $${kit.practice.budgetUsd.toFixed(2)}` : t("settings.prep.practiceOff")} ok={kit.practice.enabled && Boolean(practiceChallenge)} />
          <Row label={t("settings.prep.bringLabel")} value={brings.length ? brings.join(", ") : t("settings.prep.bringNothing")} />
          <div className="card-foot" style={{ gap: 8 }}>
            <Link href="/settings/prep" className="btn btn-primary btn-sm" data-el="edit-prep">{t("settings.prep.edit")}</Link>
            <a href="/api/admin/prep/export" className="btn btn-ghost btn-sm" download>{t("settings.prep.export")}</a>
            <span className="faint" style={{ marginLeft: "auto", fontSize: 12 }}>{kitSaved ? t("settings.prep.savedAt", { when: when(i18n, kitSaved.updatedAt) }) : t("settings.prep.importHint")}</span>
          </div>
        </section>

        <section className="card" data-el="key-path">
          <div className="card-head">{t("settings.keyPath.title")}<span className="aside">{t("settings.keyPath.aside")}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", alignItems: "center", gap: 12, padding: "20px 16px" }}>
            {([
              ["settings.keyPath.sandbox", "settings.keyPath.sandboxText", false],
              ["settings.keyPath.gateway", "settings.keyPath.gatewayText", true],
              ["settings.keyPath.anthropic", "settings.keyPath.anthropicText", false],
            ] as const).map(([titleKey, textKey, on], i) => (
              <div key={titleKey} style={{ display: "contents" }}>
                {i > 0 && <span className="faint" aria-hidden="true" style={{ display: "flex" }}><IconArrow size={16} /></span>}
                <div style={{ padding: "12px 14px", borderRadius: "var(--r)", border: `1px solid ${on ? "rgba(124,108,255,.45)" : "var(--border-strong)"}`, background: on ? "var(--accent-soft)" : "var(--bg-raised)" }}>
                  <div style={{ fontWeight: 500, color: on ? "var(--accent-text)" : undefined }}>{t(titleKey)}</div>
                  <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{t(textKey)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 24 }}>
          <section className="card" id="providers">
            <div className="card-head">{t("settings.ai.title")}</div>
            <Row label={<>{t("settings.keyPath.anthropic")}<Env name="ANTHROPIC_API_KEY" /></>} value={<span style={{ color: env.anthropicKey ? "var(--ok)" : "var(--warn)" }}>{env.anthropicKey ? t("settings.ai.connected") : t("settings.ai.noKey")}</span>} ok={Boolean(env.anthropicKey)} />
            <Row label={t("settings.ai.upstream")} value={<span className="mono" style={{ fontSize: 12 }}>{env.anthropicUpstream}</span>} />
            <Row label={t("settings.ai.monthlyCap")} value={<span className="num">${env.monthlyBudgetUsd}</span>} />
          </section>
          <section className="card" id="sandboxes">
            <div className="card-head">{t("settings.sandbox.title")}</div>
            <Row label={t("settings.sandbox.driver")} value={<span className="mono">{env.sandbox.driver}</span>} ok={docker.ok} />
            <Row label={t("settings.sandbox.status")} value={docker.detail} />
            <Row label={t("settings.sandbox.isolation")} value={process.env.SEEDLING_SANDBOX_RUNTIME ? <span className="mono">{process.env.SEEDLING_SANDBOX_RUNTIME}</span> : t("settings.sandbox.defaultRuntime")} ok={Boolean(process.env.SEEDLING_SANDBOX_RUNTIME)} />
            <Row label={t("settings.sandbox.perSessionLabel")} value={<span className="num">{t("settings.sandbox.perSession", { cpus: env.sandbox.cpus, mb: env.sandbox.memoryMb, pids: env.sandbox.pids })}</span>} />
            <Row label={t("settings.sandbox.concurrentLabel")} value={<span className="num">{t("settings.sandbox.concurrent", { max: env.sandbox.maxConcurrent })}</span>} />
            <Row label={t("settings.sandbox.networkLabel")} value={env.sandbox.network ? <span className="mono">{env.sandbox.network}</span> : t("settings.sandbox.dockerDefault")} ok={Boolean(env.sandbox.network)} />
          </section>
          <section className="card" id="auth">
            <div className="card-head">{t("settings.auth.title")}</div>
            <Row label={t("settings.auth.methods")} value={[t("settings.auth.password"), providers.google && "Google", providers.github && "GitHub"].filter(Boolean).join(", ")} ok />
            <Row label={t("settings.auth.domains")} value={env.allowedDomains.length ? env.allowedDomains.join(", ") : t("settings.auth.anyDomain")} />
            <Row label={t("settings.auth.inviteEmails")} value={mailConfigured() ? t("settings.auth.smtpOn") : t("settings.auth.smtpOff")} ok={mailConfigured()} />
            <Row label={t("settings.auth.newAccounts")} value={mailConfigured() ? t("settings.auth.confirmRequired") : t("settings.auth.inviteOnly")} ok />
          </section>
          <section className="card" id="admins" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-head">{t("settings.admins.title")}<span className="count">{env.adminEmails.length + admins.length}</span></div>
            {env.adminEmails.length + admins.length === 0 && <div className="list-item faint">{t("settings.admins.empty")}</div>}
            {env.adminEmails.map((e) => <AdminRow key={e} email={e} hasAccount={users.has(e)} badge={<span className="pill" style={{ flex: "none" }}>{t("settings.admins.fromEnv")}</span>} />)}
            {admins.filter((a) => !env.adminEmails.includes(a.email)).map((a) => (
              <AdminRow key={a.email} email={a.email} hasAccount={users.has(a.email)} actions={<form action={removeAdmin.bind(null, a.email)} style={{ flex: "none" }}><button className="btn btn-ghost btn-sm">{t("common.remove")}</button></form>} />
            ))}
            <InviteAdmin />
          </section>
        </div>

        <section className="card" data-el="audit-log">
          <div className="card-head">{t("settings.audit.title")}<span className="aside">{t("settings.audit.aside")}</span></div>
          {log.length === 0 && <div className="list-item faint">{t("settings.audit.empty")}</div>}
          {log.map((l) => (
            <div key={l.id} className="row" style={{ gridTemplateColumns: "110px minmax(0,1fr) minmax(0,1.2fr) minmax(0,1fr) 120px", gap: 16, fontSize: 12, padding: "10px 16px" }}>
              <span className="faint num">{when(i18n, l.createdAt)}</span>
              <span className="truncate">{displayName(l.actor)}</span>
              <span className="muted truncate">{recorded(i18n, l.action)}</span>
              <span className="faint mono truncate" style={{ fontSize: 11.5 }}>{recorded(i18n, l.target)}</span>
              <span className="faint mono truncate" style={{ textAlign: "right", fontSize: 11.5 }}>{l.ip}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
