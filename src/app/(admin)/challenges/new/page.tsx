import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Uploader } from "./uploader";

export const metadata: Metadata = { title: "New challenge" };

const roles = [
  ["CHALLENGE.md or README.md", "pill-accent", "Brief"],
  ["src/, data/, starter code", "pill-cand", "Candidate sees"],
  ["tests/, *.test.*", "pill-cand", "Visible tests"],
  ["hidden-tests/", "pill-warn", "Team only"],
  ["solution/", "pill-warn", "Reference"],
  ["RUBRIC.md, seedling.json", "pill-warn", "Team only"],
] as const;

export default function NewChallengePage() {
  return (
    <>
      <PageHeader crumb="Challenges" crumbHref="/challenges" title="New challenge" />
      <div className="page" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          <div>
            <h2 className="hero-title">Upload a challenge</h2>
            <p className="muted" style={{ marginTop: 14, maxWidth: "62ch", fontSize: 14, lineHeight: 1.6 }}>Zip the challenge folder and drop it below. You&apos;ll see the brief exactly as the candidate will, the rubric, and automatic checks before you publish.</p>
          </div>
          <Uploader />
          <section className="card">
            <div className="card-head">How files are sorted<span className="aside">by folder and file name</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
              {roles.map(([name, pill, label], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderTop: i > 1 ? "1px solid var(--border)" : undefined, borderLeft: i % 2 ? "1px solid var(--border)" : undefined }}>
                  <span className="mono truncate" style={{ flex: 1, fontSize: 12 }}>{name}</span>
                  <span className={`pill ${pill}`}>{label}</span>
                </div>
              ))}
            </div>
            <div className="card-foot faint" style={{ fontSize: 12, flexDirection: "column", alignItems: "flex-start", gap: 6 }}><span>List the data traps under a &quot;## Traps&quot; heading in RUBRIC.md; each one becomes a checkbox in the review. See examples/book-inventory in the repo.</span><span>Anything marked <b style={{ color: "var(--warn)", fontWeight: 500 }}>Team only</b> or <b style={{ color: "var(--warn)", fontWeight: 500 }}>Reference</b> never reaches the candidate&apos;s sandbox or what Claude can read.</span></div>
          </section>
        </div>
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card">
            <div className="card-head">seedling.json<span className="aside">optional</span></div>
            <div className="card-body">
              <p className="faint" style={{ fontSize: 12, lineHeight: 1.55 }}>Level, type, time and test commands are read from it when present. You can change all of it later.</p>
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
            <div style={{ fontWeight: 500 }}>Checks before publishing</div>
            <p className="faint" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.55 }}>The reference solution passes the hidden tests, the starter code doesn&apos;t, and no secrets ship with it.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
