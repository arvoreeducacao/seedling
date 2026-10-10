import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { listSessions, remainingMs } from "@/lib/sessions";
import { clock, money, relativeDays, when } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { StatusBadge } from "@/components/status-badge";
import { Person } from "@/components/person";
import { Empty } from "@/components/empty";
import { SegNav } from "@/components/motion";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("sessions.title") };
}

const filters = ["all", "live", "waiting", "review", "decided"] as const;

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const i18n = await getI18n();
  const { t } = i18n;
  const { filter = "all" } = await searchParams;
  const [sessions, challenges, calls] = await Promise.all([listSessions(), db.query.challenges.findMany({ columns: { id: true, title: true } }), db.query.aiCalls.findMany({ columns: { sessionId: true, costUsd: true } })]);
  const groups = {
    all: sessions,
    live: sessions.filter((s) => s.status === "running" || s.status === "paused"),
    waiting: sessions.filter((s) => s.status === "invited"),
    review: sessions.filter((s) => (s.status === "submitted" || s.status === "expired") && !s.decision),
    decided: sessions.filter((s) => s.decision),
  } as const;
  const key = (filter in groups ? filter : "all") as keyof typeof groups;
  const shown = groups[key];
  const title = (id: string) => {
    const found = challenges.find((c) => c.id === id);
    if (!found) return t("sessions.deletedChallenge");
    return found.title || t("challenges.untitled");
  };
  const cols = "minmax(0,1.6fr) minmax(0,1.5fr) minmax(0,1.2fr) minmax(0,1fr) 128px";
  return (
    <>
      <PageHeader
        title={t("sessions.title")}
        sub={<span className="num">{sessions.length}</span>}
        actions={<Link href="/sessions/new" className="btn btn-primary" data-el="new-session">{t("sessions.invite")} <span className="kbd">C</span></Link>}
      />
      <div className="shell shell-body" style={{ gap: 20 }}>
        <div className="toolbar" data-el="filters">
          <SegNav ariaLabel={t("sessions.filterAria")} items={filters.map((k) => ({ href: k === "all" ? "/sessions" : `/sessions?filter=${k}`, label: t(`sessions.filter.${k}`), count: groups[k].length, active: key === k }))} />
        </div>
        {shown.length === 0 ? (
          <div className="data-table">
            {sessions.length === 0 ? (
              <Empty title={t("sessions.empty.title")} text={t("sessions.empty.text")} action={<Link href="/sessions/new" className="btn btn-primary">{t("sessions.empty.action")}</Link>} />
            ) : (
              <Empty title={t("sessions.noMatch.title")} text={t("sessions.noMatch.text")} action={<Link href="/sessions" className="btn">{t("sessions.noMatch.action")}</Link>} />
            )}
          </div>
        ) : (
          <div className="data-table" style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 900 }} data-el="rows" className="stagger">
              <div className="row-head" style={{ gridTemplateColumns: cols, gap: 16 }}><span>{t("sessions.col.candidate")}</span><span>{t("sessions.col.challenges")}</span><span>{t("sessions.col.status")}</span><span>{t("sessions.col.spend")}</span><span style={{ textAlign: "right" }}>{t("sessions.col.when")}</span></div>
              {shown.map((s, i) => {
                const spent = calls.filter((c) => c.sessionId === s.id).reduce((sum, c) => sum + c.costUsd, 0);
                const href = s.status === "submitted" || s.status === "expired" ? `/sessions/${s.id}/report` : `/sessions/${s.id}`;
                const dim = s.status === "cancelled";
                const first = s.challengeIds[0];
                return (
                  <Link key={s.id} href={href} className="row" style={{ gridTemplateColumns: cols, gap: 16, color: dim ? "var(--text-3)" : undefined, ["--i" as string]: Math.min(i, 12) }} data-el={s.status === "running" ? "live-row" : undefined}>
                    <Person email={s.candidateEmail} name={s.candidateName} sub={s.candidateEmail} avatar dim={dim} />
                    <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span className="truncate" style={{ color: dim ? undefined : "var(--text-2)" }}>{first ? title(first) : "—"}</span>
                      {s.challengeIds.length > 1 && <span className="pill" style={{ flex: "none" }} title={s.challengeIds.slice(1).map(title).join(", ")}>+{s.challengeIds.length - 1}</span>}
                    </span>
                    <span data-el={s.status === "submitted" || s.status === "expired" ? "status-review" : undefined} style={{ minWidth: 0 }}>
                      <StatusBadge i18n={i18n} status={s.status} decision={s.decision} detail={s.status === "running" ? `${s.currentIndex + 1}/${s.challengeIds.length} · ${clock(remainingMs(s))}` : undefined} />
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                      {s.status === "invited" ? (
                        <span className="faint truncate">{t("sessions.plannedSpend", { minutes: s.minutes, budget: money(i18n, s.budgetUsd) })}</span>
                      ) : (
                        <>
                          <span className="num" style={{ fontSize: 13 }}><span style={{ color: s.status === "running" ? "var(--text)" : "var(--text-2)" }}>{money(i18n, spent)}</span><span className="faint"> / {money(i18n, s.budgetUsd)}</span></span>
                          <span className="bar" style={{ height: 3, maxWidth: 120 }}><i style={{ width: `${Math.max(2, Math.min(100, (spent / s.budgetUsd) * 100))}%`, background: spent / s.budgetUsd > 0.8 ? "var(--warn)" : undefined }} /></span>
                        </>
                      )}
                    </span>
                    <span style={{ textAlign: "right", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                      {s.status === "running" ? <span className="btn btn-sm">{t("sessions.watch")}</span> : s.status === "invited" ? t("date.expiresIn", { when: relativeDays(i18n, s.inviteExpiresAt) }) : when(i18n, s.startedAt ?? s.createdAt)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
