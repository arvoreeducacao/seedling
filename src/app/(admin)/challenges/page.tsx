import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { SegNav } from "@/components/motion";
import { db, schema } from "@/lib/db";
import { levelLabel, levelPill } from "@/lib/format";

export const metadata: Metadata = { title: "Challenges" };

const statusPill = {
  published: ["pill-ok", "Published"],
  draft: ["", "Draft"],
  checking: ["pill-accent", "Checking"],
  error: ["pill-err", "Has errors"],
} as const;

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ level?: string; kind?: string }> }) {
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
      <PageHeader title="Challenges" sub={<span className="num">{challenges.length}</span>} actions={<Link href="/challenges/new" className="btn btn-primary" data-el="new-challenge">New challenge</Link>} />
      <div className="shell shell-body" style={{ gap: 20 }}>
        {challenges.length === 0 ? (
          <div className="data-table">
            <Empty title="No challenges yet" text="Upload a challenge folder as a .zip. Seedling separates what the candidate sees from what only your team sees." action={<Link href="/challenges/new" className="btn btn-primary">Upload your first challenge</Link>} />
          </div>
        ) : (
          <>
            <div className="toolbar">
              <SegNav ariaLabel="Filter by level" items={[{ href: href({ level: undefined }), label: "All levels", active: !level }, ...(["junior", "pleno", "senior"] as const).map((l) => ({ href: href({ level: l }), label: levelLabel[l], count: challenges.filter((c) => c.level === l).length, active: level === l }))]} />
              <SegNav ariaLabel="Filter by type" items={[{ href: href({ kind: undefined }), label: "Any type", active: !kind }, { href: href({ kind: "code" }), label: "Code", active: kind === "code" }, { href: href({ kind: "screen" }), label: "UI", active: kind === "screen" }]} />
              <span className="faint" style={{ marginLeft: "auto", fontSize: 13 }}>Drafts can&apos;t be used in invites</span>
            </div>
            <div className="data-table" style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 940 }} className="stagger">
                <div className="row-head" style={{ gridTemplateColumns: cols, gap: 16 }}>
                  <span>Challenge</span><span>Level</span><span>Type</span><span>Time</span><span>Avg. hidden tests</span><span>Tests</span><span style={{ textAlign: "right" }}>Status</span>
                </div>
                {shown.length === 0 && <Empty title="No matches" text="No challenge fits this level and type." action={<Link href="/challenges" className="btn">Clear filters</Link>} />}
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
                        <div className="truncate" style={{ fontWeight: 600, color: draft ? "var(--text-2)" : "var(--text)" }}>{c.title}</div>
                        <div className="truncate" style={{ fontSize: 12.5, color: failing ? "#ff8a8e" : "var(--text-3)" }}>{failing ? failing.title : `${c.runtime} · used in ${used.length} session${used.length === 1 ? "" : "s"}`}</div>
                      </div>
                      <span><span className={`pill ${levelPill[c.level]}`}>{levelLabel[c.level]}</span></span>
                      <span className="muted">{c.kind === "screen" ? "UI" : "Code"}</span>
                      <span className="num muted">{c.minutes} min</span>
                      {avg === null ? <span className="faint">{draft ? "—" : "No results yet"}</span> : (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="bar" style={{ width: 80, height: 5 }}><i style={{ width: `${avg}%`, background: avg >= 70 ? "var(--ok)" : avg >= 40 ? "var(--warn)" : "var(--err)" }} /></div>
                          <span className="num muted" style={{ fontSize: 12.5 }}>{avg}%</span>
                        </div>
                      )}
                      <span className="truncate" style={{ color: c.status === "error" ? "#ff8a8e" : c.fileCounts.hidden ? "var(--text-2)" : "var(--text-3)" }}>{c.fileCounts.hidden ? `${c.fileCounts.hidden} hidden file${c.fileCounts.hidden === 1 ? "" : "s"}` : "No hidden tests"}</span>
                      <span style={{ textAlign: "right" }}><span className={`pill ${pill}`}>{label}</span></span>
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
