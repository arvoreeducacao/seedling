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
import { checkDetail, checkTitle } from "@/lib/checks";
import { getI18n } from "@/lib/i18n/server";
import type { Key, T } from "@/lib/i18n";
import { publish, recheck, removeChallenge, unpublish, updateChallenge } from "../actions";

const rolePill: Record<"statement" | "visible" | "visible-test" | "hidden" | "reference" | "team", [string, Key]> = {
  statement: ["pill-accent", "challenges.role.statement"],
  visible: ["pill-cand", "challenges.role.visible"],
  "visible-test": ["pill-cand", "challenges.role.visibleTest"],
  hidden: ["pill-warn", "challenges.role.teamOnly"],
  reference: ["pill-warn", "challenges.role.reference"],
  team: ["pill-warn", "challenges.role.teamOnly"],
};

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

function highlighted(t: T, key: Key) {
  const parts: Record<string, string> = { teamOnly: t("challenges.role.teamOnly"), reference: t("challenges.role.reference") };
  return t(key)
    .split(/(\{\w+\})/g)
    .map((piece, index) =>
      piece.startsWith("{") && parts[piece.slice(1, -1)] ? (
        <b key={index} style={{ color: "var(--warn)", fontWeight: 500 }}>{parts[piece.slice(1, -1)]}</b>
      ) : (
        piece
      ),
    );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { t } = await getI18n();
  const { id } = await params;
  const challenge = await db.query.challenges.findFirst({ where: eq(schema.challenges.id, id), columns: { title: true } });
  if (!challenge) return { title: t("challenges.one") };
  return { title: challenge.title || t("challenges.untitled") };
}

export default async function ChallengePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const i18n = await getI18n();
  const { t } = i18n;
  const { id } = await params;
  const { tab = "brief" } = await searchParams;
  const challenge = await db.query.challenges.findFirst({ where: eq(schema.challenges.id, id) });
  if (!challenge) notFound();
  const files = await db.query.challengeFiles.findMany({ where: eq(schema.challengeFiles.challengeId, id), orderBy: asc(schema.challengeFiles.path) });
  const groups = folders(files);
  const checking = challenge.status === "checking";
  const blocked = challenge.status === "error";
  const doc = tab === "rubric" ? (challenge.rubric ?? t("challenges.noRubric")) : challenge.statement || t("challenges.noBrief");
  const [pill, status]: [string, Key] =
    challenge.status === "published"
      ? ["pill-ok", "challenges.status.published"]
      : blocked
        ? ["pill-err", "challenges.status.error"]
        : checking
          ? ["pill-accent", "challenges.status.checking"]
          : ["", "challenges.status.draft"];
  const tabs: [string, Key][] = [
    ["brief", "challenges.tabBrief"],
    ["rubric", "challenges.tabRubric"],
  ];
  return (
    <>
      {checking && <AutoRefresh ms={2500} />}
      <PageHeader
        wide
        crumb={t("challenges.title")} crumbHref="/challenges"
        title={challenge.title || t("challenges.untitled")}
        extra={<span className={`pill ${pill}`}>{t(status)}</span>}
        actions={
          <>
            <form action={removeChallenge.bind(null, id)}><button className="btn btn-ghost">{t("common.delete")}</button></form>
            {challenge.status === "published" ? (
              <form action={unpublish.bind(null, id)}><button className="btn">{t("challenges.moveToDraft")}</button></form>
            ) : (
              <form action={publish.bind(null, id)}><button className="btn btn-primary" disabled={blocked || checking} data-el="publish-challenge">{t("challenges.publish")}</button></form>
            )}
          </>
        }
      />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "clamp(220px, 20vw, 300px) minmax(0,1fr) clamp(300px, 26vw, 360px)", minHeight: 0 }}>
        <aside data-el="imported-files" className="scroll-thin" style={{ borderRight: "1px solid var(--border)", padding: "16px 12px", overflowY: "auto" }}>
          <div className="label" style={{ padding: "0 8px 8px" }}>{t("challenges.fileCount", { n: files.length })}</div>
          <div className="mono" style={{ display: "flex", flexDirection: "column", gap: 1, fontSize: 12 }}>
            {groups.map(([name, g]) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: "var(--r-xs)" }}>
                <span className="truncate" style={{ flex: 1 }}>{g.isDir ? `${name}` : name}{g.isDir && <span className="faint"> {g.count}</span>}</span>
                <span className={`pill ${rolePill[g.role][0]}`} style={{ height: 18, fontSize: 10.5, fontFamily: "var(--font-sans)" }}>{t(rolePill[g.role][1])}</span>
              </div>
            ))}
          </div>
          <div className="notice notice-quiet" style={{ marginTop: 16, fontSize: 11.5 }}>
            {highlighted(t, "challenges.privateNotice")}
          </div>
        </aside>
        <section style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <nav className="underline-tabs" style={{ alignItems: "center" }}>
            {tabs.map(([key, label]) => (
              <a key={key} href={`?tab=${key}`} aria-current={tab === key ? "page" : undefined}>{t(label)}</a>
            ))}
            <span className="faint" style={{ marginLeft: "auto", fontSize: 12 }}>{tab === "rubric" ? t("challenges.rubricNote") : t("challenges.briefNote")}</span>
          </nav>
          <div className="prose-md" style={{ padding: "32px 40px", maxWidth: 780 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(doc) }} />
        </section>
        <aside className="scroll-thin" style={{ borderLeft: "1px solid var(--border)", padding: 20, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <form action={updateChallenge.bind(null, id)} className="card" data-el="challenge-settings">
            <div className="card-head">{t("challenges.settings")}</div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label className="field"><span>{t("challenges.fieldTitle")}</span><input className="input" name="title" defaultValue={challenge.title} /></label>
              <div className="field"><span>{t("challenges.fieldLevel")}</span>
                <Segmented name="level" ariaLabel={t("challenges.fieldLevel")} block defaultValue={challenge.level} options={(["junior", "pleno", "senior"] as const).map((l) => ({ value: l, label: levelLabel(i18n, l) }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }}>
                <div className="field"><span>{t("challenges.fieldType")}</span>
                  <Select name="kind" ariaLabel={t("challenges.fieldType")} defaultValue={challenge.kind} options={[{ value: "code", label: t("kind.code.title"), text: t("kind.code.title") }, { value: "screen", label: t("challenges.kindScreen"), text: t("challenges.kindScreen") }]} />
                </div>
                <label className="field"><span>{t("challenges.fieldMinutes")}</span>
                  <span className="input input-group"><input name="minutes" type="number" min={5} max={480} defaultValue={challenge.minutes} className="num" /><span className="addon">{t("common.minutes")}</span></span>
                </label>
              </div>
              <label className="field"><span>{t("challenges.fieldRuntime")}</span><input className="input mono" value={challenge.runtime} readOnly /></label>
              <label className="field"><span>{t("challenges.fieldVisibleCommand")}</span><input className="input mono" name="visibleTestCommand" defaultValue={challenge.visibleTestCommand ?? ""} placeholder="npm test" style={{ fontSize: 12 }} /></label>
              <label className="field"><span>{t("challenges.fieldHiddenCommand")}</span><input className="input mono" name="hiddenTestCommand" defaultValue={challenge.hiddenTestCommand ?? ""} placeholder="node --test hidden-tests/" style={{ fontSize: 12 }} /></label>
            </div>
            <div className="card-foot"><button className="btn" style={{ marginLeft: "auto" }}>{t("challenges.saveChanges")}</button></div>
          </form>
          <div className="card" data-el="checks">
            <div className="card-head">{t("challenges.checksTitle")}
              <form action={recheck.bind(null, id)} className="aside"><button className="btn btn-ghost btn-sm" disabled={checking}>{checking ? t("challenges.running") : t("challenges.runAgain")}</button></form>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12.5 }}>
              {checking && <div className="muted">{t("challenges.checkingNote")}</div>}
              {!checking && challenge.checks.length === 0 && <div className="faint">{t("challenges.noChecks")}</div>}
              {challenge.checks.map((check) => (
                <div key={check.key} style={{ display: "flex", gap: 10 }}>
                  <span style={{ color: check.ok ? "var(--ok)" : check.key === "statement-leak" ? "var(--warn)" : "var(--err)", marginTop: 2, display: "flex" }}>{check.ok ? <IconCheck size={14} /> : <IconAlert size={14} />}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: check.ok ? "var(--text)" : check.key === "statement-leak" ? "var(--warn)" : "#ff8a8e" }}>{checkTitle(t, check)}</div>
                    <div className="faint" style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.5 }}>{checkDetail(t, check)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" data-el="traps">
            <div className="card-head">{t("challenges.trapsTitle")}<span className="count">{challenge.traps.length}</span></div>
            <div className="card-body">
              {challenge.traps.length ? (
                <ul style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, listStyle: "disc", paddingLeft: 16 }} className="muted">{challenge.traps.map((trap) => <li key={trap}>{trap}</li>)}</ul>
              ) : (
                <div className="faint" style={{ fontSize: 12, lineHeight: 1.55 }}>{t("challenges.trapsEmpty")}</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
