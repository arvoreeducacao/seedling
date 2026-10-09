"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Select } from "@/components/select";
import { Segmented } from "@/components/segmented";
import { IconAlert, IconCheck } from "@/components/icons";
import type { Kit, KitSection, PracticeMode } from "@/lib/prep/kit";
import { PLAYGROUND_DEFAULTS } from "@/lib/prep/playground";
import { importKitAction, resetKitAction, saveKitAction, type KitResult } from "./actions";

type ChallengeOption = { id: string; title: string; minutes: number };

function Row({ title, text, children, el }: { title: string; text?: React.ReactNode; children: React.ReactNode; el?: string }) {
  return (
    <div className="form-row" data-el={el}>
      <div className="form-row-label"><b>{title}</b>{text && <span>{text}</span>}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="toggle" data-on={on} onClick={() => onChange(!on)} style={{ cursor: "pointer" }} />
  );
}

function Arrow({ up }: { up?: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={up ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} /></svg>;
}

function Cross() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}

const practiceHint: Record<PracticeMode, string> = {
  off: "Candidates only read the kit and bring their setup.",
  playground: "A free sandbox with a tiny sample project and Claude Code running, no challenge needed. Not graded.",
  challenge: "A warm-up on one of your published challenges, clearly labeled as practice.",
};

let draftCounter = 0;
const draftId = () => `new${Date.now().toString(36)}${(draftCounter++).toString(36)}`;

function SectionEditor({ section, index, total, onChange, onMove, onRemove }: { section: KitSection; index: number; total: number; onChange: (s: KitSection) => void; onMove: (by: number) => void; onRemove: () => void }) {
  const setLink = (i: number, patch: Partial<KitSection["links"][number]>) => onChange({ ...section, links: section.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  return (
    <div className="card" data-el="kit-section" style={{ overflow: "visible" }}>
      <div className="card-head" style={{ gap: 10 }}>
        <span className="step-num">{index + 1}</span>
        <input className="input" value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })} placeholder="Section title" aria-label={`Section ${index + 1} title`} style={{ flex: 1, fontWeight: 500 }} />
        <span style={{ display: "flex", gap: 2 }}>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}><Arrow up /></button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Move down" disabled={index === total - 1} onClick={() => onMove(1)}><Arrow /></button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Remove section ${index + 1}`} onClick={onRemove}><Cross /></button>
        </span>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <textarea className="input" rows={5} value={section.body} onChange={(e) => onChange({ ...section, body: e.target.value })} placeholder="What to read or do, in markdown. **bold**, lists, `code` and [links](https://…) work." aria-label={`Section ${index + 1} text`} style={{ fontSize: 13 }} />
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Links</div>
          {section.links.length === 0 && <div className="faint" style={{ fontSize: 12, marginBottom: 8 }}>No links. Add the reads or videos for this section.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {section.links.map((link, i) => (
              <div key={i} data-el="kit-link" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr) auto", gap: 8, padding: 10, borderRadius: "var(--r)", border: "1px solid var(--border)", background: "var(--bg-raised)" }}>
                <input className="input" value={link.title} onChange={(e) => setLink(i, { title: e.target.value })} placeholder="Title" aria-label="Link title" />
                <input className="input mono" value={link.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="https://" aria-label="Link URL" style={{ fontSize: 12 }} />
                <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Remove link" onClick={() => onChange({ ...section, links: section.links.filter((_, j) => j !== i) })} style={{ alignSelf: "center" }}><Cross /></button>
                <input className="input" value={link.why} onChange={(e) => setLink(i, { why: e.target.value })} placeholder="Why it matters (optional)" aria-label="Why it matters" style={{ gridColumn: "1 / -1", fontSize: 12.5 }} />
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => onChange({ ...section, links: [...section.links, { title: "", url: "", why: "" }] })}>Add link</button>
        </div>
      </div>
    </div>
  );
}

export function KitEditor({ initial, challenges, updated }: { initial: Kit; challenges: ChallengeOption[]; updated: string | null }) {
  const [kit, setKit] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [result, setResult] = useState<KitResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [imported, importAction, importing] = useActionState<KitResult | null, FormData>(importKitAction, null);
  const [fileName, setFileName] = useState<string | null>(null);
  const dirty = useMemo(() => JSON.stringify(kit) !== saved, [kit, saved]);

  useEffect(() => {
    if (imported?.ok) {
      setKit(imported.kit);
      setSaved(JSON.stringify(imported.kit));
    }
    if (imported) {
      setResult(imported);
      setFileName(null);
    }
  }, [imported]);

  const patch = (p: Partial<Kit>) => setKit((k) => ({ ...k, ...p }));
  const setSection = (i: number, s: KitSection) => patch({ sections: kit.sections.map((x, j) => (j === i ? s : x)) });
  const move = (i: number, by: number) => {
    const next = [...kit.sections];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    patch({ sections: next });
  };

  function apply(run: () => Promise<KitResult>) {
    startTransition(async () => {
      const r = await run();
      setResult(r);
      if (r.ok) {
        setKit(r.kit);
        setSaved(JSON.stringify(r.kit));
      }
    });
  }

  function setPracticeMode(mode: PracticeMode) {
    const limits = mode === "playground" && kit.practice.mode !== "playground" ? PLAYGROUND_DEFAULTS : { budgetUsd: kit.practice.budgetUsd, minutes: kit.practice.minutes };
    patch({ practice: { ...kit.practice, ...limits, mode, enabled: mode !== "off" } });
  }

  const practiceOptions = challenges.map((c) => ({ value: c.id, label: c.title, text: c.title, hint: `${c.minutes} min` }));

  return (
    <div className="page" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 24, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <section className="card">
          <div className="card-head">About the kit</div>
          <Row title="Name" text="Shown above the candidate's prep page." el="kit-name">
            <input className="input" value={kit.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Interview prep" aria-label="Kit name" />
          </Row>
          <Row title="How we work" text="A short summary of how your team builds software. Markdown." el="kit-how">
            <textarea className="input" rows={8} value={kit.howWeWork} onChange={(e) => patch({ howWeWork: e.target.value })} aria-label="How we work" style={{ fontSize: 13 }} />
          </Row>
          <Row title="Opens" text="Relative to the interview date set on the invite. Invites without a date see the kit right away." el="kit-opens">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label className="input input-group" style={{ width: 120 }}>
                <input type="number" min={0} max={60} value={kit.opensDaysBefore} onChange={(e) => patch({ opensDaysBefore: Math.max(0, Math.min(60, Math.round(Number(e.target.value) || 0))) })} aria-label="Days before the interview" className="num" />
                <span className="addon">days</span>
              </label>
              <span className="muted" style={{ fontSize: 12.5 }}>before the interview</span>
            </div>
          </Row>
        </section>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
          <div>
            <div style={{ fontWeight: 600 }}>Sections</div>
            <div className="faint" style={{ fontSize: 12 }}>Shown in this order. Candidates check each one off and you see how far they got.</div>
          </div>
          <span className="faint num" style={{ fontSize: 12 }}>{kit.sections.length} of 30</span>
        </div>
        {kit.sections.map((section, i) => (
          <SectionEditor key={section.id} section={section} index={i} total={kit.sections.length} onChange={(s) => setSection(i, s)} onMove={(by) => move(i, by)} onRemove={() => patch({ sections: kit.sections.filter((_, j) => j !== i) })} />
        ))}
        <button type="button" className="btn" style={{ alignSelf: "flex-start" }} disabled={kit.sections.length >= 30} onClick={() => patch({ sections: [...kit.sections, { id: draftId(), title: "", body: "", links: [] }] })} data-el="add-section">Add section</button>

        <section className="card" style={{ marginTop: 8, overflow: "visible" }} data-el="kit-practice">
          <div className="card-head">Practice<span className="aside">never counts in the evaluation</span></div>
          <Row title="Before the interview" text={practiceHint[kit.practice.mode]}>
            <Segmented ariaLabel="Practice" value={kit.practice.mode} onChange={setPracticeMode} options={[{ value: "off", label: "Off" }, { value: "playground", label: "Playground" }, { value: "challenge", label: "A specific challenge" }]} />
          </Row>
          {kit.practice.mode === "challenge" && (
            <Row title="Challenge" text="Any published challenge. Pick something small and different from the real one.">
              {practiceOptions.length ? (
                <div style={{ maxWidth: 360 }}>
                  <Select value={kit.practice.challengeId ?? ""} placeholder="Choose a challenge…" onChange={(id) => patch({ practice: { ...kit.practice, challengeId: id } })} ariaLabel="Practice challenge" options={practiceOptions} />
                </div>
              ) : (
                <div className="notice notice-warn">Publish a challenge first, or use the playground.</div>
              )}
            </Row>
          )}
          {kit.practice.mode !== "off" && (
            <Row title="Limits" text="One run per candidate, separate from the interview budget. It uses a sandbox room only while it runs.">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label className="input input-group" style={{ width: 130 }}>
                  <input type="number" min={5} max={120} value={kit.practice.minutes} onChange={(e) => patch({ practice: { ...kit.practice, minutes: Math.round(Number(e.target.value) || 0) } })} aria-label="Practice minutes" className="num" />
                  <span className="addon">min</span>
                </label>
                <label className="input input-group" style={{ width: 150 }}>
                  <span className="addon">$</span>
                  <input type="number" step="0.25" min={0.1} max={20} value={kit.practice.budgetUsd} onChange={(e) => patch({ practice: { ...kit.practice, budgetUsd: Number(e.target.value) || 0 } })} aria-label="Practice AI budget in US dollars" className="num" />
                  <span className="addon">USD</span>
                </label>
              </div>
            </Row>
          )}
        </section>

        <section className="card" data-el="kit-bring">
          <div className="card-head">What candidates may bring<span className="aside">installed only in their own sandbox</span></div>
          {([
            ["skills", "Skills", "Folders with a SKILL.md, uploaded as a folder, a zip or pasted. Installed in ~/.claude/skills."],
            ["claudeMd", "CLAUDE.md", "Their personal instructions, installed as ~/.claude/CLAUDE.md."],
            ["mcpServers", "MCP servers", "Remote http or sse servers only. Local commands are rejected. Secrets are masked for the team."],
          ] as const).map(([key, title, text]) => (
            <Row key={key} title={title} text={text}>
              <Toggle on={kit.bring[key]} onChange={(on) => patch({ bring: { ...kit.bring, [key]: on } })} label={`Allow ${title}`} />
            </Row>
          ))}
        </section>
      </div>

      <aside style={{ position: "sticky", top: 72, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card">
          <div className="card-head">Publish</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className="btn btn-primary btn-block" disabled={!dirty || pending} onClick={() => apply(() => saveKitAction(JSON.stringify(kit)))} data-el="save-kit">{pending ? "Saving…" : dirty ? "Save kit" : "Saved"}</button>
            <div className="faint" style={{ fontSize: 11.5 }}>{dirty ? "You have unsaved changes." : updated ? `Last saved ${updated}.` : "Using the default kit."}</div>
            {result && (
              <div className={`notice ${result.ok ? "notice-quiet" : "notice-err"}`} role={result.ok ? "status" : "alert"} style={{ fontSize: 12 }}>
                <span style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>{result.ok ? <IconCheck size={13} /> : <IconAlert size={13} />}{result.ok ? result.message : result.error}</span>
                {result.ok && result.notes.map((n) => <div key={n} style={{ marginTop: 6, color: "var(--warn)" }}>{n}</div>)}
              </div>
            )}
          </div>
        </div>
        <div className="card" data-el="kit-share">
          <div className="card-head">Share</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <a className="btn btn-block" href="/api/admin/prep/export" download data-el="export-kit">Export as JSON</a>
            <form action={importAction} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label className="btn btn-ghost btn-block" style={{ cursor: "pointer", justifyContent: "flex-start", border: "1px dashed var(--border-strong)" }}>
                <input type="file" name="file" accept="application/json,.json" aria-label="Kit file to import" data-el="import-file" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
                <span className="truncate">{fileName ?? "Choose a .json kit…"}</span>
              </label>
              <button className="btn btn-block" disabled={importing || !fileName} data-el="import-kit">{importing ? "Importing…" : "Import and replace"}</button>
            </form>
            <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.5 }}>Kits are plain JSON, so teams can share theirs. The practice challenge travels by its slug. See examples/prep in the repo.</div>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => { if (confirm("Replace the kit with the default one?")) apply(resetKitAction); }}>Reset to default</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
