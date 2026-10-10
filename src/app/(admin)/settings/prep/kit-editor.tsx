"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Select } from "@/components/select";
import { Segmented } from "@/components/segmented";
import { IconAlert, IconCheck } from "@/components/icons";
import { useI18n } from "@/components/i18n";
import type { Key } from "@/lib/i18n";
import type { Kit, KitSection, PracticeMode } from "@/lib/prep/kit";
import { PLAYGROUND_DEFAULTS } from "@/lib/prep/playground";
import { importKitAction, resetKitAction, saveKitAction, type KitResult } from "./actions";

type ChallengeOption = { id: string; title: string; minutes: number };

const MAX_SECTIONS = 30;

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

const practiceHint: Record<PracticeMode, Key> = {
  off: "kit.practiceHint.off",
  playground: "kit.practiceHint.playground",
  challenge: "kit.practiceHint.challenge",
};

const bringRows = [
  { key: "skills", label: "kit.bring.skills", text: "kit.bringText.skills" },
  { key: "claudeMd", label: "kit.bring.claudeMd", text: "kit.bringText.claudeMd" },
  { key: "mcpServers", label: "kit.bring.mcpServers", text: "kit.bringText.mcpServers" },
] as const satisfies readonly { key: keyof Kit["bring"]; label: Key; text: Key }[];

let draftCounter = 0;
const draftId = () => `new${Date.now().toString(36)}${(draftCounter++).toString(36)}`;

function SectionEditor({ section, index, total, onChange, onMove, onRemove }: { section: KitSection; index: number; total: number; onChange: (s: KitSection) => void; onMove: (by: number) => void; onRemove: () => void }) {
  const { t } = useI18n();
  const setLink = (i: number, patch: Partial<KitSection["links"][number]>) => onChange({ ...section, links: section.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  return (
    <div className="card" data-el="kit-section" style={{ overflow: "visible" }}>
      <div className="card-head" style={{ gap: 10 }}>
        <span className="step-num">{index + 1}</span>
        <input className="input" value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })} placeholder={t("kit.sectionTitlePlaceholder")} aria-label={t("kit.sectionTitleAria", { index: index + 1 })} style={{ flex: 1, fontWeight: 500 }} />
        <span style={{ display: "flex", gap: 2 }}>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t("kit.moveUp")} disabled={index === 0} onClick={() => onMove(-1)}><Arrow up /></button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t("kit.moveDown")} disabled={index === total - 1} onClick={() => onMove(1)}><Arrow /></button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t("kit.removeSection", { index: index + 1 })} onClick={onRemove}><Cross /></button>
        </span>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <textarea className="input" rows={5} value={section.body} onChange={(e) => onChange({ ...section, body: e.target.value })} placeholder={t("kit.sectionBodyPlaceholder")} aria-label={t("kit.sectionBodyAria", { index: index + 1 })} style={{ fontSize: 13 }} />
        <div>
          <div className="label" style={{ marginBottom: 8 }}>{t("kit.links")}</div>
          {section.links.length === 0 && <div className="faint" style={{ fontSize: 12, marginBottom: 8 }}>{t("kit.noLinks")}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {section.links.map((link, i) => (
              <div key={i} data-el="kit-link" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr) auto", gap: 8, padding: 10, borderRadius: "var(--r)", border: "1px solid var(--border)", background: "var(--bg-raised)" }}>
                <input className="input" value={link.title} onChange={(e) => setLink(i, { title: e.target.value })} placeholder={t("kit.linkTitlePlaceholder")} aria-label={t("kit.linkTitleAria")} />
                <input className="input mono" value={link.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="https://" aria-label={t("kit.linkUrlAria")} style={{ fontSize: 12 }} />
                <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t("kit.removeLink")} onClick={() => onChange({ ...section, links: section.links.filter((_, j) => j !== i) })} style={{ alignSelf: "center" }}><Cross /></button>
                <input className="input" value={link.why} onChange={(e) => setLink(i, { why: e.target.value })} placeholder={t("kit.linkWhyPlaceholder")} aria-label={t("kit.linkWhyAria")} style={{ gridColumn: "1 / -1", fontSize: 12.5 }} />
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => onChange({ ...section, links: [...section.links, { title: "", url: "", why: "" }] })}>{t("kit.addLink")}</button>
        </div>
      </div>
    </div>
  );
}

export function KitEditor({ initial, challenges, updated }: { initial: Kit; challenges: ChallengeOption[]; updated: string | null }) {
  const { t } = useI18n();
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

  const practiceOptions = challenges.map((c) => ({ value: c.id, label: c.title, text: c.title, hint: `${c.minutes} ${t("common.minutes")}` }));

  return (
    <div className="page" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 24, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <section className="card">
          <div className="card-head">{t("kit.about")}</div>
          <Row title={t("kit.name")} text={t("kit.nameText")} el="kit-name">
            <input className="input" value={kit.name} onChange={(e) => patch({ name: e.target.value })} placeholder={t("kit.namePlaceholder")} aria-label={t("kit.nameAria")} />
          </Row>
          <Row title={t("kit.how")} text={t("kit.howText")} el="kit-how">
            <textarea className="input" rows={8} value={kit.howWeWork} onChange={(e) => patch({ howWeWork: e.target.value })} aria-label={t("kit.how")} style={{ fontSize: 13 }} />
          </Row>
          <Row title={t("kit.opens")} text={t("kit.opensText")} el="kit-opens">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label className="input input-group" style={{ width: 120 }}>
                <input type="number" min={0} max={60} value={kit.opensDaysBefore} onChange={(e) => patch({ opensDaysBefore: Math.max(0, Math.min(60, Math.round(Number(e.target.value) || 0))) })} aria-label={t("kit.daysAria")} className="num" />
                <span className="addon">{t("kit.days")}</span>
              </label>
              <span className="muted" style={{ fontSize: 12.5 }}>{t("kit.beforeInterview")}</span>
            </div>
          </Row>
        </section>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
          <div>
            <div style={{ fontWeight: 600 }}>{t("kit.sections")}</div>
            <div className="faint" style={{ fontSize: 12 }}>{t("kit.sectionsText")}</div>
          </div>
          <span className="faint num" style={{ fontSize: 12 }}>{t("kit.sectionsCount", { count: kit.sections.length, max: MAX_SECTIONS })}</span>
        </div>
        {kit.sections.map((section, i) => (
          <SectionEditor key={section.id} section={section} index={i} total={kit.sections.length} onChange={(s) => setSection(i, s)} onMove={(by) => move(i, by)} onRemove={() => patch({ sections: kit.sections.filter((_, j) => j !== i) })} />
        ))}
        <button type="button" className="btn" style={{ alignSelf: "flex-start" }} disabled={kit.sections.length >= MAX_SECTIONS} onClick={() => patch({ sections: [...kit.sections, { id: draftId(), title: "", body: "", links: [] }] })} data-el="add-section">{t("kit.addSection")}</button>

        <section className="card" style={{ marginTop: 8, overflow: "visible" }} data-el="kit-practice">
          <div className="card-head">{t("kit.practice")}<span className="aside">{t("kit.practiceAside")}</span></div>
          <Row title={t("kit.practiceRow")} text={t(practiceHint[kit.practice.mode])}>
            <Segmented ariaLabel={t("kit.practice")} value={kit.practice.mode} onChange={setPracticeMode} options={[{ value: "off", label: t("kit.practiceMode.off") }, { value: "playground", label: t("kit.practiceMode.playground") }, { value: "challenge", label: t("kit.practiceMode.challenge") }]} />
          </Row>
          {kit.practice.mode === "challenge" && (
            <Row title={t("kit.challenge")} text={t("kit.challengeText")}>
              {practiceOptions.length ? (
                <div style={{ maxWidth: 360 }}>
                  <Select value={kit.practice.challengeId ?? ""} placeholder={t("kit.challengePlaceholder")} onChange={(id) => patch({ practice: { ...kit.practice, challengeId: id } })} ariaLabel={t("kit.challengeAria")} options={practiceOptions} />
                </div>
              ) : (
                <div className="notice notice-warn">{t("kit.noPublished")}</div>
              )}
            </Row>
          )}
          {kit.practice.mode !== "off" && (
            <Row title={t("kit.limits")} text={t("kit.limitsText")}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label className="input input-group" style={{ width: 130 }}>
                  <input type="number" min={5} max={120} value={kit.practice.minutes} onChange={(e) => patch({ practice: { ...kit.practice, minutes: Math.round(Number(e.target.value) || 0) } })} aria-label={t("kit.minutesAria")} className="num" />
                  <span className="addon">{t("common.minutes")}</span>
                </label>
                <label className="input input-group" style={{ width: 150 }}>
                  <span className="addon">$</span>
                  <input type="number" step="0.25" min={0.1} max={20} value={kit.practice.budgetUsd} onChange={(e) => patch({ practice: { ...kit.practice, budgetUsd: Number(e.target.value) || 0 } })} aria-label={t("kit.budgetAria")} className="num" />
                  <span className="addon">USD</span>
                </label>
              </div>
            </Row>
          )}
        </section>

        <section className="card" data-el="kit-bring">
          <div className="card-head">{t("kit.bringTitle")}<span className="aside">{t("kit.bringAside")}</span></div>
          {bringRows.map(({ key, label, text }) => (
            <Row key={key} title={t(label)} text={t(text)}>
              <Toggle on={kit.bring[key]} onChange={(on) => patch({ bring: { ...kit.bring, [key]: on } })} label={t("kit.allow", { what: t(label) })} />
            </Row>
          ))}
        </section>
      </div>

      <aside style={{ position: "sticky", top: 72, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card">
          <div className="card-head">{t("kit.publish")}</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className="btn btn-primary btn-block" disabled={!dirty || pending} onClick={() => apply(() => saveKitAction(JSON.stringify(kit)))} data-el="save-kit">{pending ? t("common.saving") : dirty ? t("kit.save") : t("common.saved")}</button>
            <div className="faint" style={{ fontSize: 11.5 }}>{dirty ? t("kit.unsaved") : updated ? t("kit.lastSaved", { updated }) : t("kit.usingDefault")}</div>
            {result && (
              <div className={`notice ${result.ok ? "notice-quiet" : "notice-err"}`} role={result.ok ? "status" : "alert"} style={{ fontSize: 12 }}>
                <span style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>{result.ok ? <IconCheck size={13} /> : <IconAlert size={13} />}{result.ok ? result.message : result.error}</span>
                {result.ok && result.notes.map((n) => <div key={n} style={{ marginTop: 6, color: "var(--warn)" }}>{n}</div>)}
              </div>
            )}
          </div>
        </div>
        <div className="card" data-el="kit-share">
          <div className="card-head">{t("kit.share")}</div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <a className="btn btn-block" href="/api/admin/prep/export" download data-el="export-kit">{t("kit.exportJson")}</a>
            <form action={importAction} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label className="btn btn-ghost btn-block" style={{ cursor: "pointer", justifyContent: "flex-start", border: "1px dashed var(--border-strong)" }}>
                <input type="file" name="file" accept="application/json,.json" aria-label={t("kit.fileAria")} data-el="import-file" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
                <span className="truncate">{fileName ?? t("kit.chooseFile")}</span>
              </label>
              <button className="btn btn-block" disabled={importing || !fileName} data-el="import-kit">{importing ? t("kit.importing") : t("kit.import")}</button>
            </form>
            <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.5 }}>{t("kit.shareHint")}</div>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => { if (confirm(t("kit.resetConfirm"))) apply(resetKitAction); }}>{t("kit.reset")}</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
