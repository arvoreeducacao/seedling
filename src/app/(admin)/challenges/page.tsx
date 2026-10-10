import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { SegNav } from "@/components/motion";
import { db, schema } from "@/lib/db";
import { levelLabel, levelPill } from "@/lib/format";
import { checkTitle } from "@/lib/checks";
import { getI18n } from "@/lib/i18n/server";
import type { Key } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("challenges.title") };
}

const statusPill: Record<"published" | "draft" | "checking" | "error", [string, Key]> = {
  published: ["pill-ok", "challenges.status.published"],
  draft: ["", "challenges.status.draft"],
  checking: ["pill-accent", "challenges.status.checking"],
  error: ["pill-err", "challenges.status.error"],
};

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ level?: string; kind?: string }> }) {
  const i18n = await getI18n();
  const { t } = i18n;
  const { level, kind } = await searchParams;
  const [challenges, attempts] = await Promise.all([
    db.query.challenges.findMany({ orderBy: desc(schema.challenges.createdAt) }),
    db.query.attempts.findMany({ columns: { challengeId: true, hiddenPassed: true, hiddenTotal: true } }),
  ]);
  const shown = challenges.filter((c) => (!level || c.level === level) && (!kind || c.kind === kind));
  const href = (next: { level?: string; kind?: string }) => {
    const q = new URLSearchParams();
    const l = "level" in next ? next.level : level;
    const k = "kind" in next ? next.kind : kind;
    if (l) q.set("level", l);
    if (k) q.set("kind", k);
    const s = q.toString();
    return s ? `/challenges?${s}` : "/challenges";
  };
  const cols = "minmax(0,2.4fr) 84px 72px 72px minmax(0,1.2fr) minmax(0,1.1fr) 104px";
  return (
    <>
      <PageHeader title={t("challenges.title")} sub={<span className="num">{challenges.length}</span>} actions={<Link href="/challenges/new" className="btn btn-primary" data-el="new-challenge">{t("challenges.new")}</Link>} />
      <div className="shell shell-body" style={{ gap: 20 }}>
        {challenges.length === 0 ? (
          <div className="data-table">
            <Empty title={t("challenges.emptyTitle")} text={t("challenges.emptyText")} action={<Link href="/challenges/new" className="btn btn-primary">{t("challenges.emptyAction")}</Link>} />
          </div>
        ) : (
          <>
            <div className="toolbar">
              <SegNav ariaLabel={t("challenges.filterLevel")} items={[{ href: href({ level: undefined }), label: t("challenges.allLevels"), active: !level }, ...(["junior", "pleno", "senior"] as const).map((l) => ({ href: href({ level: l }), label: levelLabel(i18n, l), count: challenges.filter((c) => c.level === l).length, active: level === l }))]} />
              <SegNav ariaLabel={t("challenges.filterType")} items={[{ href: href({ kind: undefined }), label: t("challenges.anyType"), active: !kind }, { href: href({ kind: "code" }), label: t("kind.code.title"), active: kind === "code" }, { href: href({ kind: "screen" }), label: t("challenges.kindScreen"), active: kind === "screen" }]} />
              <span className="faint" style={{ marginLeft: "auto", fontSize: 13 }}>{t("challenges.draftsNote")}</span>
            </div>
            <div className="data-table" style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 940 }} className="stagger">
                <div className="row-head" style={{ gridTemplateColumns: cols, gap: 16 }}>
                  <span>{t("challenges.one")}</span><span>{t("challenges.colLevel")}</span><span>{t("challenges.colType")}</span><span>{t("challenges.colTime")}</span><span>{t("challenges.colAvgHidden")}</span><span>{t("challenges.colTests")}</span><span style={{ textAlign: "right" }}>{t("challenges.colStatus")}</span>
                </div>
                {shown.length === 0 && <Empty title={t("challenges.noMatchesTitle")} text={t("challenges.noMatchesText")} action={<Link href="/challenges" className="btn">{t("challenges.clearFilters")}</Link>} />}
                {shown.map((c, i) => {
                  const used = attempts.filter((a) => a.challengeId === c.id);
                  const done = used.filter((a) => a.hiddenTotal);
                  const avg = done.length ? Math.round((done.reduce((s, a) => s + (a.hiddenPassed ?? 0) / (a.hiddenTotal ?? 1), 0) / done.length) * 100) : null;
                  const [pill, label] = statusPill[c.status];
                  const failing = c.checks.find((k) => !k.ok && k.key !== "statement-leak");
                  const draft = c.status === "draft";
                  return (
                    <Link key={c.id} href={`/challenges/${c.id}`} className="row" style={{ gridTemplateColumns: cols, gap: 16, color: draft ? "var(--text-2)" : undefined, ["--i" as string]: Math.min(i, 12) }} data-el="challenge-row">
                      <div style={{ minWidth: 0 }}>
                        <div className="truncate" style={{ fontWeight: 600, color: draft ? "var(--text-2)" : "var(--text)" }}>{c.title || t("challenges.untitled")}</div>
                        <div className="truncate" style={{ fontSize: 12.5, color: failing ? "#ff8a8e" : "var(--text-3)" }}>{failing ? checkTitle(t, failing) : `${c.runtime} · ${t("challenges.usedIn", { n: used.length })}`}</div>
                      </div>
                      <span><span className={`pill ${levelPill[c.level]}`}>{levelLabel(i18n, c.level)}</span></span>
                      <span className="muted">{c.kind === "screen" ? t("challenges.kindScreen") : t("kind.code.title")}</span>
                      <span className="num muted">{c.minutes} {t("common.minutes")}</span>
                      {avg === null ? <span className="faint">{draft ? "—" : t("challenges.noResults")}</span> : (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="bar" style={{ width: 80, height: 5 }}><i style={{ width: `${avg}%`, background: avg >= 70 ? "var(--ok)" : avg >= 40 ? "var(--warn)" : "var(--err)" }} /></div>
                          <span className="num muted" style={{ fontSize: 12.5 }}>{avg}%</span>
                        </div>
                      )}
                      <span className="truncate" style={{ color: c.status === "error" ? "#ff8a8e" : c.fileCounts.hidden ? "var(--text-2)" : "var(--text-3)" }}>{c.fileCounts.hidden ? t("challenges.hiddenFiles", { n: c.fileCounts.hidden }) : t("challenges.noHiddenTests")}</span>
                      <span style={{ textAlign: "right" }}><span className={`pill ${pill}`}>{t(label)}</span></span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
