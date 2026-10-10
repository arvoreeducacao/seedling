import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getI18n } from "@/lib/i18n/server";
import type { Key, T } from "@/lib/i18n";
import { Uploader } from "./uploader";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("challenges.new") };
}

const roles: [string, string, Key][] = [
  ["CHALLENGE.md or README.md", "pill-accent", "challenges.role.statement"],
  ["src/, data/, starter code", "pill-cand", "challenges.role.visible"],
  ["tests/, *.test.*", "pill-cand", "challenges.role.visibleTest"],
  ["hidden-tests/", "pill-warn", "challenges.role.teamOnly"],
  ["solution/", "pill-warn", "challenges.role.reference"],
  ["RUBRIC.md, seedling.json", "pill-warn", "challenges.role.teamOnly"],
];

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

export default async function NewChallengePage() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader crumb={t("challenges.title")} crumbHref="/challenges" title={t("challenges.new")} />
      <div className="page" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          <div>
            <h2 className="hero-title">{t("challenges.uploadTitle")}</h2>
            <p className="muted" style={{ marginTop: 14, maxWidth: "62ch", fontSize: 14, lineHeight: 1.6 }}>{t("challenges.uploadText")}</p>
          </div>
          <Uploader />
          <section className="card">
            <div className="card-head">{t("challenges.sortingTitle")}<span className="aside">{t("challenges.sortingAside")}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
              {roles.map(([name, pill, label], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderTop: i > 1 ? "1px solid var(--border)" : undefined, borderLeft: i % 2 ? "1px solid var(--border)" : undefined }}>
                  <span className="mono truncate" style={{ flex: 1, fontSize: 12 }}>{name}</span>
                  <span className={`pill ${pill}`}>{t(label)}</span>
                </div>
              ))}
            </div>
            <div className="card-foot faint" style={{ fontSize: 12, flexDirection: "column", alignItems: "flex-start", gap: 6 }}><span>{t("challenges.sortingTraps")}</span><span>{highlighted(t, "challenges.privateNoticeShort")}</span></div>
          </section>
        </div>
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card">
            <div className="card-head">seedling.json<span className="aside">{t("challenges.manifestOptional")}</span></div>
            <div className="card-body">
              <p className="faint" style={{ fontSize: 12, lineHeight: 1.55 }}>{t("challenges.manifestText")}</p>
              <pre className="mono scroll-thin" style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.65, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 12, overflowX: "auto", color: "var(--text-2)" }}>{`{
  "title": "Book inventory",
  "level": "senior",
  "minutes": 35,
  "test": {
    "hidden": "node --test 'hidden-tests/**/*.test.js'"
  }
}`}</pre>
            </div>
          </section>
          <section className="card card-body">
            <div style={{ fontWeight: 500 }}>{t("challenges.publishChecksTitle")}</div>
            <p className="faint" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.55 }}>{t("challenges.publishChecksText")}</p>
          </section>
        </aside>
      </div>
    </>
  );
}
