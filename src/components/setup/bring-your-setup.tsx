"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileText, Lightning, Lock, Plug, Trash, UploadSimple, Warning, TreeStructure } from "@phosphor-icons/react";
import type { SetupView } from "@/lib/setup/store";
import ui from "@/components/workspace/ui.module.css";
import { useI18n } from "@/components/i18n";
import { hasKey, type T } from "@/lib/i18n";
import css from "./setup.module.css";

type Section = "skills" | "claudeMd" | "mcp";
type Errors = Partial<Record<Section, string>>;

const MCP_EXAMPLE = `{
  "mcpServers": {
    "linear": { "type": "sse", "url": "https://mcp.linear.app/sse" },
    "docs": {
      "type": "http",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer ..." }
    }
  }
}`;

const SKILL_EXAMPLE = `---
name: review-helper
description: How I like diffs reviewed
---
Read the whole diff before commenting...`;

function kb(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function worded(t: T, message: string) {
  return hasKey(message) ? t(message) : message;
}

function ErrorLine({ text }: { text?: string }) {
  return (
    <AnimatePresence initial={false}>
      {text && (
        <motion.div key={text} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
          <div className={css.error} role="alert"><Warning size={14} weight="bold" /><span>{text}</span></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Card({ el, icon, title, sub, children, off }: { el: string; icon: React.ReactNode; title: string; sub: string; children: React.ReactNode; off?: boolean }) {
  const { t } = useI18n();
  return (
    <section className={css.card} data-el={el}>
      <div className={css.cardHead}>
        <span className={css.cardIcon}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <div className={css.cardTitle}>{title}</div>
          <div className={css.cardSub}>{sub}</div>
        </div>
      </div>
      {off ? <div className={css.note}><Lock size={14} /> {t("setup.turnedOff")}</div> : children}
    </section>
  );
}

function Item({ name, meta, extra, onRemove, disabled }: { name: string; meta: React.ReactNode; extra?: React.ReactNode; onRemove?: () => void; disabled?: boolean }) {
  const { t } = useI18n();
  const remove = t("setup.removeItem", { name });
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: -6 }} transition={{ duration: 0.16 }} className={css.item}>
      <div className={css.itemMain}>
        <span className={css.itemName}>{name}</span>
        <span className={css.itemMeta}>{meta}</span>
        {extra}
      </div>
      {onRemove && (
        <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} onClick={onRemove} disabled={disabled} aria-label={remove} title={remove}>
          <Trash size={14} />
        </button>
      )}
    </motion.li>
  );
}

function Preview({ setup }: { setup: SetupView }) {
  const { t } = useI18n();
  const lines: React.ReactNode[] = [];
  const policy = setup.policy;
  if (policy.skills && setup.skills.length) {
    lines.push(<span key="sk" className={css.treeDir}>~/.claude/skills/</span>);
    setup.skills.forEach((skill, i) => {
      const lastSkill = i === setup.skills.length - 1;
      lines.push(<span key={`s-${skill.name}`}>{`${lastSkill ? "└─" : "├─"} `}<span className={css.treeDir}>{skill.name}/</span></span>);
      skill.files.forEach((file, j) => {
        const last = j === skill.files.length - 1;
        lines.push(<span key={`f-${skill.name}-${file.path}`}>{`${lastSkill ? "   " : "│  "}${last ? "└─" : "├─"} ${file.path}`}<span className={css.treeMuted}>{`  ${kb(file.size)}`}</span></span>);
      });
    });
  }
  if (policy.claudeMd && setup.claudeMd) lines.push(<span key="md">~/.claude/CLAUDE.md<span className={css.treeMuted}>{`  ${kb(setup.claudeMd.size)}`}</span></span>);
  if (policy.mcpServers && setup.mcpServers.length) {
    lines.push(<span key="mc">~/.claude.json <span className={css.treeMuted}>mcpServers</span></span>);
    lines.push(<span key="pw" className={css.treeMuted}>{`├─ playwright  ${t("setup.preview.playwright")}`}</span>);
    setup.mcpServers.forEach((s, i) => lines.push(<span key={`m-${s.name}`}>{`${i === setup.mcpServers.length - 1 ? "└─" : "├─"} ${s.name}  `}<span className={css.treeMuted}>{s.type}</span></span>));
  }
  const filePct = Math.min(100, (setup.totals.files / setup.limits.files) * 100);
  const bytePct = Math.min(100, (setup.totals.bytes / setup.limits.totalBytes) * 100);
  return (
    <section className={css.card} data-el="setup-preview">
      <div className={css.cardHead}>
        <span className={css.cardIcon}><TreeStructure size={15} /></span>
        <div>
          <div className={css.cardTitle}>{t("setup.preview.title")}</div>
          <div className={css.cardSub}>{t("setup.preview.sub")}</div>
        </div>
      </div>
      {lines.length ? (
        <pre className={css.tree}>{lines.map((line, i) => <span key={i}>{line}{"\n"}</span>)}</pre>
      ) : (
        <div className={css.empty}>{t("setup.preview.empty")}</div>
      )}
      <div className={css.stat}>
        <div className={css.statHead}><span>{t("setup.preview.files")}</span><span className={ui.mono}>{setup.totals.files} / {setup.limits.files}</span></div>
        <div className={css.meter}><i style={{ width: `${filePct}%` }} /></div>
      </div>
      <div className={css.stat}>
        <div className={css.statHead}><span>{t("setup.preview.size")}</span><span className={ui.mono}>{kb(setup.totals.bytes)} / {kb(setup.limits.totalBytes)}</span></div>
        <div className={css.meter}><i style={{ width: `${bytePct}%` }} /></div>
      </div>
      <div className={css.cardSub} style={{ lineHeight: 1.55 }}>{t("setup.preview.note")}</div>
    </section>
  );
}

export function BringYourSetup({ token, onItems }: { token: string; onItems?: (count: number) => void }) {
  const { t } = useI18n();
  const [setup, setSetup] = useState<SetupView | null>(null);
  const [editable, setEditable] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<Section | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillBody, setSkillBody] = useState("");
  const [claudeMd, setClaudeMd] = useState("");
  const [claudeMdDirty, setClaudeMdDirty] = useState(false);
  const [mcpJson, setMcpJson] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const base = `/api/s/${token}/setup`;

  const itemsListener = useRef(onItems);
  useEffect(() => {
    itemsListener.current = onItems;
  }, [onItems]);

  const apply = useCallback((json: { setup: SetupView; editable: boolean }) => {
    setSetup(json.setup);
    setEditable(json.editable);
    itemsListener.current?.(json.setup.skills.length + json.setup.mcpServers.length + (json.setup.claudeMd ? 1 : 0));
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(base, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok || !json?.setup) {
          setLoadError(typeof json?.error === "string" && json.error ? worded(t, json.error) : t("setup.loadFailed"));
          return;
        }
        apply(json);
        setClaudeMd(json.setup.claudeMd?.content ?? "");
      })
      .catch(() => alive && setLoadError(t("setup.loadFailed")));
    return () => {
      alive = false;
    };
  }, [base, apply, t]);

  async function send(section: Section, url: string, init: RequestInit) {
    setBusy(section);
    setErrors((e) => ({ ...e, [section]: undefined }));
    const res = await fetch(url, init).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok || !json?.setup) {
      setErrors((e) => ({ ...e, [section]: typeof json?.error === "string" && json.error ? worded(t, json.error) : t("prep.somethingWentWrong") }));
      return false;
    }
    apply(json);
    return true;
  }

  async function uploadZip(file: File) {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setErrors((e) => ({ ...e, skills: t("setup.skills.wrongFile") }));
      return;
    }
    const form = new FormData();
    form.append("file", file);
    await send("skills", `${base}/skills`, { method: "POST", body: form });
  }

  async function pasteSkill() {
    const ok = await send("skills", `${base}/skills`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: skillName, content: skillBody }) });
    if (ok) {
      setSkillName("");
      setSkillBody("");
      setPasteOpen(false);
    }
  }

  async function saveClaudeMd() {
    if (await send("claudeMd", `${base}/claude-md`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: claudeMd }) })) setClaudeMdDirty(false);
  }

  async function addMcp() {
    if (await send("mcp", `${base}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: mcpJson }) })) setMcpJson("");
  }

  if (loadError) return <div className={`${ui.root} ${css.wrap}`} style={{ background: "transparent" }}><div className={css.error} role="alert"><Warning size={14} weight="bold" /><span>{loadError}</span></div></div>;
  if (!setup) return <div className={`${ui.root} ${css.wrap}`} style={{ background: "transparent" }}><div className={ui.skeleton} style={{ height: 240, borderRadius: 16 }} /></div>;

  const locked = !editable;
  const policy = setup.policy;

  return (
    <div className={`${ui.root} ${css.wrap}`} style={{ background: "transparent" }} data-el="bring-your-setup">
      {locked && <div className={css.note}><Lock size={14} /> {t("setup.locked")}</div>}
      <div className={css.grid}>
        <div className={css.column}>
          <Card el="setup-skills" icon={<Lightning size={15} weight="fill" />} title={t("setup.skills.title")} sub={t("setup.skills.sub")} off={!policy.skills}>
            {!locked && (
              <>
                <button
                  type="button"
                  className={`${css.drop} ${dragging ? css.dropActive : ""}`}
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) void uploadZip(file);
                  }}
                  disabled={busy === "skills"}
                  data-el="skill-drop"
                >
                  {busy === "skills" ? <span className={ui.spinner} style={{ width: 18, height: 18 }} /> : <UploadSimple size={20} />}
                  <span className={css.dropTitle}>{busy === "skills" ? t("setup.skills.checking") : t("setup.skills.drop")}</span>
                  <span className={css.cardSub}>{t("setup.skills.dropHint", { files: setup.limits.files, size: kb(setup.limits.totalBytes) })}</span>
                </button>
                <input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  if (file) void uploadZip(file);
                }} />
                <button type="button" className={css.toggle} onClick={() => setPasteOpen((v) => !v)} aria-expanded={pasteOpen}>{pasteOpen ? t("setup.skills.hidePaste") : t("setup.skills.showPaste")}</button>
                <AnimatePresence initial={false}>
                  {pasteOpen && (
                    <motion.div key="paste" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", display: "flex", flexDirection: "column", gap: 8 }}>
                      <input className={ui.input} placeholder={t("setup.skills.namePlaceholder")} value={skillName} onChange={(e) => setSkillName(e.target.value)} aria-label={t("setup.skills.nameLabel")} />
                      <textarea className={css.textarea} placeholder={SKILL_EXAMPLE} value={skillBody} onChange={(e) => setSkillBody(e.target.value)} aria-label={t("setup.skills.bodyLabel")} />
                      <div className={css.row}><span className={css.spacer} /><button type="button" className={`${ui.btn} ${ui.btnPrimary} ${ui.btnSm}`} onClick={() => void pasteSkill()} disabled={busy === "skills" || !skillBody.trim()}>{t("setup.skills.add")}</button></div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
            <ErrorLine text={errors.skills} />
            {setup.skills.length ? (
              <ul className={css.list}>
                <AnimatePresence initial={false}>
                  {setup.skills.map((skill) => (
                    <Item key={skill.name} name={skill.name} meta={`${skill.description ? `${skill.description} · ` : ""}${t("setup.fileCount", { n: skill.files.length })}`} disabled={busy !== null} onRemove={locked ? undefined : () => void send("skills", `${base}/skills/${encodeURIComponent(skill.name)}`, { method: "DELETE" })} />
                  ))}
                </AnimatePresence>
              </ul>
            ) : locked ? <div className={css.empty}>{t("setup.skills.none")}</div> : null}
          </Card>

          <Card el="setup-claude-md" icon={<FileText size={15} />} title="CLAUDE.md" sub={t("setup.claudeMd.sub")} off={!policy.claudeMd}>
            <textarea className={css.textarea} style={{ minHeight: 140 }} placeholder={t("setup.claudeMd.placeholder")} value={claudeMd} disabled={locked} onChange={(e) => {
              setClaudeMd(e.target.value);
              setClaudeMdDirty(true);
            }} aria-label={t("setup.claudeMd.label")} data-el="claude-md" />
            <ErrorLine text={errors.claudeMd} />
            {!locked && (
              <div className={css.row}>
                <span className={css.cardSub}>{setup.claudeMd ? t("setup.claudeMd.saved", { size: kb(setup.claudeMd.size) }) : t("setup.claudeMd.unsaved")}</span>
                <span className={css.spacer} />
                {setup.claudeMd && <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} onClick={async () => {
                  if (await send("claudeMd", `${base}/claude-md`, { method: "DELETE" })) {
                    setClaudeMd("");
                    setClaudeMdDirty(false);
                  }
                }} disabled={busy !== null}>{t("common.remove")}</button>}
                <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${ui.btnSm}`} onClick={() => void saveClaudeMd()} disabled={busy !== null || !claudeMdDirty}>{busy === "claudeMd" ? t("common.saving") : t("common.save")}</button>
              </div>
            )}
          </Card>

          <Card el="setup-mcp-servers" icon={<Plug size={15} />} title={t("setup.mcp.title")} sub={t("setup.mcp.sub")} off={!policy.mcpServers}>
            {!locked && (
              <>
                <textarea className={css.textarea} style={{ minHeight: 150 }} placeholder={MCP_EXAMPLE} value={mcpJson} onChange={(e) => setMcpJson(e.target.value)} aria-label={t("setup.mcp.label")} data-el="mcp-json" spellCheck={false} />
                <div className={css.row}>
                  <span className={css.cardSub}>{t("setup.mcp.hint")}</span>
                  <span className={css.spacer} />
                  <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${ui.btnSm}`} onClick={() => void addMcp()} disabled={busy !== null || !mcpJson.trim()}>{busy === "mcp" ? t("setup.mcp.checking") : t("setup.mcp.add")}</button>
                </div>
              </>
            )}
            <ErrorLine text={errors.mcp} />
            {setup.mcpServers.length ? (
              <ul className={css.list}>
                <AnimatePresence initial={false}>
                  {setup.mcpServers.map((server) => (
                    <Item
                      key={server.name}
                      name={server.name}
                      meta={<><span className={ui.chip} style={{ height: 18, fontSize: 10.5, marginRight: 6 }}>{server.type}</span>{server.url}</>}
                      extra={server.headers.length ? <span className={css.secret}>{server.headers.map((h) => `${h}: ••••••`).join("   ")}</span> : null}
                      disabled={busy !== null}
                      onRemove={locked ? undefined : () => void send("mcp", `${base}/mcp/${encodeURIComponent(server.name)}`, { method: "DELETE" })}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            ) : locked ? <div className={css.empty}>{t("setup.mcp.none")}</div> : null}
          </Card>
        </div>
        <div className={`${css.column} ${css.sticky}`}>
          <Preview setup={setup} />
        </div>
      </div>
    </div>
  );
}
