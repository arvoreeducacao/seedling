import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { IconAlert, IconCheck } from "@/components/icons";
import { AutoRefresh } from "@/components/auto-refresh";
import { Select } from "@/components/select";
import { Segmented } from "@/components/segmented";
import { levelLabel } from "@/lib/format";
import { db, schema } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { publish, recheck, removeChallenge, unpublish, updateChallenge } from "../actions";

const rolePill = {
  statement: ["pill-accent", "Brief"],
  visible: ["pill-cand", "Candidate sees"],
  "visible-test": ["pill-cand", "Visible tests"],
  hidden: ["pill-warn", "Team only"],
  reference: ["pill-warn", "Reference"],
  team: ["pill-warn", "Team only"],
} as const;

function folders(files: { path: string; role: keyof typeof rolePill }[]) {
  const groups = new Map<string, { role: keyof typeof rolePill; count: number; isDir: boolean }>();
  for (const f of files) {
    const top = f.path.includes("/") ? `${f.path.split("/")[0]}/` : f.path;
    const g = groups.get(top);
    if (g) g.count++;
    else groups.set(top, { role: f.role, count: 1, isDir: f.path.includes("/") });
  }
  return [...groups.entries()].sort((a, b) => Number(b[1].isDir) - Number(a[1].isDir) || a[0].localeCompare(b[0]));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const challenge = await db.query.challenges.findFirst({ where: eq(schema.challenges.id, id), columns: { title: true } });
  return { title: challenge?.title ?? "Challenge" };
}

export default async function ChallengePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "brief" } = await searchParams;
  const challenge = await db.query.challenges.findFirst({ where: eq(schema.challenges.id, id) });
  if (!challenge) notFound();
  const files = await db.query.challengeFiles.findMany({ where: eq(schema.challengeFiles.challengeId, id), orderBy: asc(schema.challengeFiles.path) });
  const groups = folders(files);
  const checking = challenge.status === "checking";
  const blocked = challenge.status === "error";
  const doc = tab === "rubric" ? (challenge.rubric ?? "_This challenge has no RUBRIC.md._") : challenge.statement || "_No brief. Add a CHALLENGE.md or README.md at the root of the folder._";
  const [pill, status] = challenge.status === "published" ? ["pill-ok", "Published"] : blocked ? ["pill-err", "Has errors"] : checking ? ["pill-accent", "Checking"] : ["", "Draft"];
  return (
    <>
      {checking && <AutoRefresh ms={2500} />}
      <PageHeader
        wide
        crumb="Challenges" crumbHref="/challenges"
        title={challenge.title}
        extra={<span className={`pill ${pill}`}>{status}</span>}
        actions={
          <>
            <form action={removeChallenge.bind(null, id)}><button className="btn btn-ghost">Delete</button></form>
            {challenge.status === "published" ? (
              <form action={unpublish.bind(null, id)}><button className="btn">Move to draft</button></form>
            ) : (
              <form action={publish.bind(null, id)}><button className="btn btn-primary" disabled={blocked || checking} data-el="publish-challenge">Publish</button></form>
            )}
          </>
        }
      />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "clamp(220px, 20vw, 300px) minmax(0,1fr) clamp(300px, 26vw, 360px)", minHeight: 0 }}>
        <aside data-el="imported-files" className="scroll-thin" style={{ borderRight: "1px solid var(--border)", padding: "16px 12px", overflowY: "auto" }}>
          <div className="label" style={{ padding: "0 8px 8px" }}>{files.length} files</div>
          <div className="mono" style={{ display: "flex", flexDirection: "column", gap: 1, fontSize: 12 }}>
            {groups.map(([name, g]) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: "var(--r-xs)" }}>
                <span className="truncate" style={{ flex: 1 }}>{g.isDir ? `${name}` : name}{g.isDir && <span className="faint"> {g.count}</span>}</span>
                <span className={`pill ${rolePill[g.role][0]}`} style={{ height: 18, fontSize: 10.5, fontFamily: "var(--font-sans)" }}>{rolePill[g.role][1]}</span>
              </div>
            ))}
          </div>
          <div className="notice notice-quiet" style={{ marginTop: 16, fontSize: 11.5 }}>
            Files marked <b style={{ color: "var(--warn)", fontWeight: 500 }}>Team only</b> or <b style={{ color: "var(--warn)", fontWeight: 500 }}>Reference</b> never reach the candidate&apos;s sandbox or what Claude can read.
          </div>
        </aside>
        <section style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <nav className="underline-tabs" style={{ alignItems: "center" }}>
            {[["brief", "Brief"], ["rubric", "Rubric"]].map(([key, label]) => (
              <a key={key} href={`?tab=${key}`} aria-current={tab === key ? "page" : undefined}>{label}</a>
            ))}
            <span className="faint" style={{ marginLeft: "auto", fontSize: 12 }}>{tab === "rubric" ? "Only your team sees this" : "As the candidate sees it"}</span>
          </nav>
          <div className="prose-md" style={{ padding: "32px 40px", maxWidth: 780 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(doc) }} />
        </section>
        <aside className="scroll-thin" style={{ borderLeft: "1px solid var(--border)", padding: 20, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <form action={updateChallenge.bind(null, id)} className="card" data-el="challenge-settings">
            <div className="card-head">Settings</div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label className="field"><span>Title</span><input className="input" name="title" defaultValue={challenge.title} /></label>
              <div className="field"><span>Level</span>
                <Segmented name="level" ariaLabel="Level" block defaultValue={challenge.level} options={(["junior", "pleno", "senior"] as const).map((l) => ({ value: l, label: levelLabel[l] }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }}>
                <div className="field"><span>Type</span>
                  <Select name="kind" ariaLabel="Type" defaultValue={challenge.kind} options={[{ value: "code", label: "Code", text: "Code" }, { value: "screen", label: "UI", text: "UI" }]} />
                </div>
                <label className="field"><span>Suggested time</span>
                  <span className="input input-group"><input name="minutes" type="number" min={5} max={480} defaultValue={challenge.minutes} className="num" /><span className="addon">min</span></span>
                </label>
              </div>
              <label className="field"><span>Runtime</span><input className="input mono" value={challenge.runtime} readOnly /></label>
              <label className="field"><span>Visible tests command</span><input className="input mono" name="visibleTestCommand" defaultValue={challenge.visibleTestCommand ?? ""} placeholder="npm test" style={{ fontSize: 12 }} /></label>
              <label className="field"><span>Hidden tests command</span><input className="input mono" name="hiddenTestCommand" defaultValue={challenge.hiddenTestCommand ?? ""} placeholder="node --test hidden-tests/" style={{ fontSize: 12 }} /></label>
            </div>
            <div className="card-foot"><button className="btn" style={{ marginLeft: "auto" }}>Save changes</button></div>
          </form>
          <div className="card" data-el="checks">
            <div className="card-head">Pre-publish checks
              <form action={recheck.bind(null, id)} className="aside"><button className="btn btn-ghost btn-sm" disabled={checking}>{checking ? "Running…" : "Run again"}</button></form>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12.5 }}>
              {checking && <div className="muted">Running the hidden tests against the starter code and the reference solution, in a container with no network…</div>}
              {!checking && challenge.checks.length === 0 && <div className="faint">No checks have run yet.</div>}
              {challenge.checks.map((check) => (
                <div key={check.key} style={{ display: "flex", gap: 10 }}>
                  <span style={{ color: check.ok ? "var(--ok)" : check.key === "statement-leak" ? "var(--warn)" : "var(--err)", marginTop: 2, display: "flex" }}>{check.ok ? <IconCheck size={14} /> : <IconAlert size={14} />}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: check.ok ? "var(--text)" : check.key === "statement-leak" ? "var(--warn)" : "#ff8a8e" }}>{check.title}</div>
                    <div className="faint" style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.5 }}>{check.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" data-el="traps">
            <div className="card-head">Traps in the data<span className="count">{challenge.traps.length}</span></div>
            <div className="card-body">
              {challenge.traps.length ? (
                <ul style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, listStyle: "disc", paddingLeft: 16 }} className="muted">{challenge.traps.map((t) => <li key={t}>{t}</li>)}</ul>
              ) : (
                <div className="faint" style={{ fontSize: 12, lineHeight: 1.55 }}>Add a &quot;## Traps&quot; section with a list to RUBRIC.md. Each item becomes a checkbox in the review.</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
