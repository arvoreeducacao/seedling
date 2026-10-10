"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Browser,
  CaretDown,
  CaretRight,
  DownloadSimple,
  File,
  FileCode,
  FileCss,
  FileCsv,
  FileDashed,
  FileHtml,
  FileImage,
  FileJs,
  FileMd,
  FilePdf,
  FilePy,
  FileSvg,
  FileTs,
  FileX,
  FolderSimple,
  MagnifyingGlass,
  SidebarSimple,
  X,
} from "@phosphor-icons/react";
import { useI18n } from "@/components/i18n";
import { defineEditorTheme, editorTheme } from "./editor-theme";
import { extensionOf, filterTree, formatBytes, hasRenderedView, kindOf, languageOf, type FileKind } from "./file-kinds";
import { DelimitedTable, ImageView, JsonTree, MarkdownDoc, PdfView, Placeholder } from "./viewers";
import { Keys } from "./ai";
import type { T } from "@/lib/i18n";
import ui from "./ui.module.css";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className={ui.empty}>
      <span className={ui.spinner} />
    </div>
  ),
});

export type Entry = { path: string; dir: boolean; size?: number; mtime?: number };
export type SaveState = "saved" | "saving" | "error" | "synced";
export type Doc = { content: string | null; binary?: boolean; tooLarge?: boolean; size?: number; mtime?: number; missing?: boolean };

export type FileSource = {
  read(path: string): Promise<Doc>;
  save?(path: string, text: string): Promise<boolean>;
  rawUrl(path: string, version?: number, download?: boolean): string;
};

export function useFileTabs(source: FileSource, { onOpened, pollMs = 2500 }: { onOpened?: (path: string) => void; pollMs?: number } = {}) {
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, Doc>>({});
  const [saved, setSaved] = useState<SaveState>("saved");
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; text: string }>());
  const synced = useRef(new Map<string, string>());
  const activeRef = useRef<string | null>(null);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  activeRef.current = active;

  const load = useCallback(async (path: string, fromPoll = false) => {
    const doc = await sourceRef.current.read(path).catch(() => null);
    if (!doc || timers.current.has(path)) return;
    const previous = synced.current.get(path);
    if (typeof doc.content === "string") synced.current.set(path, doc.content);
    setDocs((all) => {
      const current = all[path];
      if (current && current.content === doc.content && current.mtime === doc.mtime && current.missing === doc.missing) return all;
      return { ...all, [path]: doc };
    });
    if (fromPoll && previous !== undefined && typeof doc.content === "string" && doc.content !== previous && activeRef.current === path) setSaved("synced");
  }, []);

  const persist = useCallback(async (path: string, text: string) => {
    const save = sourceRef.current.save;
    if (!save) return;
    setSaved("saving");
    const ok = await save(path, text).catch(() => false);
    if (ok) synced.current.set(path, text);
    setSaved(ok ? "saved" : "error");
  }, []);

  const flushPath = useCallback(
    async (path: string) => {
      const pending = timers.current.get(path);
      if (!pending) return;
      clearTimeout(pending.timer);
      timers.current.delete(path);
      await persist(path, pending.text);
    },
    [persist],
  );

  const flush = useCallback(async () => {
    await Promise.all([...timers.current.keys()].map((path) => flushPath(path)));
  }, [flushPath]);

  const open = useCallback(
    (path: string) => {
      setTabs((list) => {
        if (list.includes(path)) return list;
        const at = activeRef.current ? list.indexOf(activeRef.current) + 1 : list.length;
        return [...list.slice(0, at), path, ...list.slice(at)];
      });
      setActive(path);
      activeRef.current = path;
      setSaved("saved");
      void load(path);
      onOpened?.(path);
    },
    [load, onOpened],
  );

  const close = useCallback(
    (path: string) => {
      void flushPath(path);
      setTabs((list) => {
        const index = list.indexOf(path);
        const next = list.filter((p) => p !== path);
        if (activeRef.current === path) {
          const neighbor = next[Math.min(index, next.length - 1)] ?? null;
          setActive(neighbor);
          activeRef.current = neighbor;
          if (neighbor) void load(neighbor);
        }
        return next;
      });
      setDocs((all) => {
        const rest = { ...all };
        delete rest[path];
        return rest;
      });
      synced.current.delete(path);
    },
    [flushPath, load],
  );

  const activate = useCallback(
    (path: string) => {
      setActive(path);
      activeRef.current = path;
      setSaved("saved");
      void load(path);
    },
    [load],
  );

  const change = useCallback(
    (path: string, text: string) => {
      if (!sourceRef.current.save) return;
      const pending = timers.current.get(path);
      if (!pending && text === synced.current.get(path)) return;
      setDocs((all) => ({ ...all, [path]: { ...all[path], content: text } }));
      if (pending) clearTimeout(pending.timer);
      timers.current.set(path, {
        text,
        timer: setTimeout(() => {
          timers.current.delete(path);
          void persist(path, text);
        }, 700),
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    for (const { timer } of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    synced.current.clear();
    setTabs([]);
    setActive(null);
    activeRef.current = null;
    setDocs({});
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void load(active, true), pollMs);
    return () => clearInterval(timer);
  }, [active, load, pollMs]);

  return { tabs, active, docs, saved, open, close, activate, change, flush, reset, source };
}

export type FileTabs = ReturnType<typeof useFileTabs>;

function iconFor(path: string, size = 14): ReactNode {
  const kind = kindOf(path);
  const ext = extensionOf(path);
  if (kind === "markdown") return <FileMd size={size} />;
  if (kind === "csv" || kind === "tsv") return <FileCsv size={size} />;
  if (kind === "image") return <FileImage size={size} />;
  if (kind === "svg") return <FileSvg size={size} />;
  if (kind === "pdf") return <FilePdf size={size} />;
  if (kind === "html") return <FileHtml size={size} />;
  if (kind === "json") return <FileCode size={size} />;
  if (["js", "mjs", "cjs", "jsx"].includes(ext)) return <FileJs size={size} />;
  if (["ts", "tsx", "mts", "cts"].includes(ext)) return <FileTs size={size} />;
  if (ext === "py") return <FilePy size={size} />;
  if (["css", "scss", "less"].includes(ext)) return <FileCss size={size} />;
  return <File size={size} />;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className={ui.match}>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

function useFreshPaths(files: Entry[]) {
  const known = useRef<Map<string, number> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const leaves = files.filter((f) => !f.dir);
    if (!known.current) {
      if (leaves.length) known.current = new Map(leaves.map((f) => [f.path, f.mtime ?? 0]));
      return;
    }
    const changed: string[] = [];
    for (const f of leaves) {
      const before = known.current.get(f.path);
      if (before === undefined || (f.mtime && before && f.mtime !== before)) changed.push(f.path);
      known.current.set(f.path, f.mtime ?? 0);
    }
    if (!changed.length) return;
    setFresh((prev) => new Set([...prev, ...changed]));
    const timer = setTimeout(() => {
      setFresh((prev) => {
        const next = new Set(prev);
        for (const p of changed) next.delete(p);
        return next;
      });
    }, 4000);
    return () => clearTimeout(timer);
  }, [files]);
  return fresh;
}

function TreeList({ files, active, query, collapsed, fresh, revealed, onToggle, onOpen }: { files: Entry[]; active: string | null; query: string; collapsed: Set<string>; fresh: Set<string>; revealed: string | null; onToggle: (path: string) => void; onOpen: (path: string) => void }) {
  const { t } = useI18n();
  const filtered = useMemo(() => filterTree(files, query), [files, query]);
  const searching = Boolean(query.trim());
  const visible = searching ? filtered : filtered.filter((f) => ![...collapsed].some((c) => f.path.startsWith(`${c}/`)));
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!revealed) return;
    list.current?.querySelector(`[data-path="${CSS.escape(revealed)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [revealed]);
  if (!files.length) return <Placeholder icon={<FolderSimple size={18} />} title={t("workspace.noFiles")}>{t("workspace.noFilesText")}</Placeholder>;
  if (searching && !filtered.length) return <Placeholder icon={<MagnifyingGlass size={18} />} title={t("workspace.noMatch")}>{t("workspace.noMatchText", { query: query.trim() })}</Placeholder>;
  return (
    <div ref={list} className={`${ui.scroll} ${ui.tree}`} data-el="files" role="tree" aria-label={t("workspace.filesTreeLabel")}>
      {visible.map((f) => {
        const depth = f.path.split("/").length - 1;
        const name = f.path.split("/").pop() ?? f.path;
        const isOpen = !collapsed.has(f.path) || searching;
        return (
          <button
            key={f.path}
            type="button"
            role="treeitem"
            aria-expanded={f.dir ? isOpen : undefined}
            aria-selected={f.path === active}
            data-path={f.path}
            className={`${ui.treeRow} ${f.path === active ? ui.treeRowActive : ""} ${fresh.has(f.path) ? ui.treeRowFresh : ""} ${f.path === revealed ? ui.flash : ""}`}
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={() => (f.dir ? onToggle(f.path) : onOpen(f.path))}
            title={f.path}
          >
            <span className={ui.treeIcon}>{f.dir ? isOpen ? <CaretDown size={11} weight="bold" /> : <CaretRight size={11} weight="bold" /> : <span style={{ width: 11 }} />}</span>
            <span className={ui.treeIcon} style={{ color: f.dir ? "var(--w-accent-2)" : undefined }}>{f.dir ? <FolderSimple size={14} weight="fill" /> : iconFor(f.path)}</span>
            <span className={ui.ellipsis}><Highlight text={name} query={searching ? query : ""} /></span>
            {fresh.has(f.path) && <span className={ui.freshDot} aria-label={t("workspace.justChanged")} />}
          </button>
        );
      })}
    </div>
  );
}

type Mode = "view" | "source";

function ViewerBody({ path, doc, mode, readOnly, tabs, generation, onPaste, onOpenPath }: { path: string; doc: Doc | undefined; mode: Mode; readOnly: boolean; tabs: FileTabs; generation: number; onPaste?: (chars: number) => void; onOpenPath: (path: string) => void }) {
  const { t } = useI18n();
  const kind = kindOf(path);
  const name = path.split("/").pop() ?? path;
  const download = tabs.source.rawUrl(path, doc?.mtime, true);
  if (!doc) return <div className={ui.empty}><span className={ui.spinner} /></div>;
  if (doc.missing) return <Placeholder icon={<FileX size={18} />} title={t("workspace.fileGone")}>{t("workspace.fileGoneText")}</Placeholder>;
  if (kind === "image") return <ImageView key={`${path}:${doc.mtime}`} src={tabs.source.rawUrl(path, doc.mtime)} name={name} size={doc.size} />;
  if (kind === "pdf") return <PdfView key={`${path}:${doc.mtime}`} src={tabs.source.rawUrl(path, doc.mtime)} name={name} />;
  if (doc.tooLarge) {
    return (
      <Placeholder icon={<FileDashed size={18} />} title={t("workspace.tooLargeTitle")} download={download}>
        <span>{doc.size !== undefined ? t("workspace.tooLargeTextWithSize", { size: formatBytes(doc.size) }) : t("workspace.tooLargeText")}</span>
      </Placeholder>
    );
  }
  if (doc.binary || doc.content === null) {
    return (
      <Placeholder icon={<FileDashed size={18} />} title={t("workspace.binaryFile")} download={download}>
        <span>{doc.size !== undefined ? t("workspace.binaryTextWithSize", { size: formatBytes(doc.size) }) : t("workspace.binaryText")}</span>
      </Placeholder>
    );
  }
  if (mode === "view" && hasRenderedView(kind)) {
    if (kind === "markdown") return <MarkdownDoc text={doc.content} path={path} rawUrl={(p) => tabs.source.rawUrl(p)} onOpenPath={onOpenPath} />;
    if (kind === "csv") return <DelimitedTable text={doc.content} delimiter="," />;
    if (kind === "tsv") return <DelimitedTable text={doc.content} delimiter={"\t"} />;
    if (kind === "json") return <JsonTree text={doc.content} />;
    if (kind === "svg") return <ImageView key={`${path}:${doc.mtime}`} src={tabs.source.rawUrl(path, doc.mtime)} name={name} size={doc.size} />;
  }
  return (
    <div style={{ flex: 1, minHeight: 0 }} data-el="editor">
      <Editor
        key={`${path}-${generation}`}
        height="100%"
        theme={editorTheme}
        beforeMount={defineEditorTheme}
        path={path}
        language={languageOf(path)}
        value={doc.content}
        onChange={(value) => tabs.change(path, value ?? "")}
        onMount={(editor) => {
          if (onPaste) editor.onDidPaste((e) => onPaste(editor.getModel()?.getValueInRange(e.range).length ?? 0));
        }}
        options={{ readOnly, domReadOnly: readOnly, fontSize: 12.5, lineHeight: 20, minimap: { enabled: false }, fontFamily: "ui-monospace, Menlo, monospace", scrollBeyondLastLine: false, tabSize: 2, automaticLayout: true, padding: { top: 10 }, renderLineHighlight: "line", overviewRulerLanes: 0, scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 } }}
      />
    </div>
  );
}

function modeLabels(t: T, kind: FileKind, readOnly: boolean): [string, string] {
  const view = kind === "markdown" ? "workspace.modePreview" : kind === "json" ? "workspace.modeTree" : kind === "svg" ? "workspace.modeImage" : "workspace.modeTable";
  return [t(view), t(readOnly ? "workspace.modeSource" : "workspace.modeEdit")];
}

export function FilesView({
  files,
  tabs,
  readOnly = false,
  wide,
  generation = 0,
  focusSearch = 0,
  onPaste,
  onOpenInBrowser,
  toolbar,
}: {
  files: Entry[];
  tabs: FileTabs;
  readOnly?: boolean;
  wide: boolean;
  generation?: number;
  focusSearch?: number;
  onPaste?: (chars: number) => void;
  onOpenInBrowser?: (path: string) => void;
  toolbar?: ReactNode;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [treeOpen, setTreeOpen] = useState(true);
  const [modes, setModes] = useState<Record<string, Mode>>({});
  const [revealed, setRevealed] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const fresh = useFreshPaths(files);
  const { active, docs } = tabs;
  const showTree = treeOpen || !active;
  const treeOnly = !wide && showTree;

  const hasActive = Boolean(active);
  useEffect(() => {
    if (!wide && hasActive) setTreeOpen(false);
  }, [wide, hasActive]);

  useEffect(() => {
    if (!focusSearch) return;
    setTreeOpen(true);
    requestAnimationFrame(() => search.current?.focus());
  }, [focusSearch]);

  function openPath(path: string) {
    tabs.open(path);
    if (!wide) setTreeOpen(false);
  }

  function reveal(dir: string) {
    setQuery("");
    setTreeOpen(true);
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const c of prev) if (dir === c || dir.startsWith(`${c}/`)) next.delete(c);
      return next;
    });
    setRevealed(dir);
    setTimeout(() => setRevealed((r) => (r === dir ? null : r)), 1300);
  }

  const leaves = files.filter((f) => !f.dir);
  const kind = active ? kindOf(active) : "code";
  const mode: Mode = active ? (modes[active] ?? (hasRenderedView(kind) ? "view" : "source")) : "source";
  const doc = active ? docs[active] : undefined;
  const editable = !readOnly && active && !doc?.missing && !doc?.binary && !doc?.tooLarge && typeof doc?.content === "string" && kind !== "image" && kind !== "pdf";
  const showsEditor = editable && (mode === "source" || !hasRenderedView(kind));
  const names = new Map<string, number>();
  for (const t of tabs.tabs) names.set(t.split("/").pop() ?? t, (names.get(t.split("/").pop() ?? t) ?? 0) + 1);

  return (
    <div className={ui.panelBody}>
    {toolbar && <div className={ui.fileBar} style={{ paddingLeft: 14 }}>{toolbar}</div>}
    <div className={ui.filesView} data-el="files-view">
      {showTree && (
        <div className={`${ui.treeCol} ${treeOnly ? ui.treeColFull : ""}`}>
          <div className={ui.treeSearch}>
            <MagnifyingGlass size={13} className={ui.faint} />
            <input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
                if (e.key === "Enter") {
                  const first = filterTree(files, query).find((f) => !f.dir);
                  if (first) openPath(first.path);
                }
              }}
              placeholder={t("workspace.searchFiles", { n: leaves.length })}
              aria-label={t("workspace.searchFilesLabel")}
              data-el="file-search"
              spellCheck={false}
            />
            {query ? (
              <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} style={{ width: 22, height: 22 }} onClick={() => setQuery("")} aria-label={t("workspace.clearSearch")}><X size={12} /></button>
            ) : (
              <Keys keys={["mod", "P"]} />
            )}
            {treeOnly && active && (
              <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} style={{ width: 24, height: 24 }} onClick={() => setTreeOpen(false)} aria-label={t("workspace.backToFile")} title={t("workspace.backToFile")}><SidebarSimple size={14} /></button>
            )}
          </div>
          <TreeList
            files={files}
            active={active}
            query={query}
            collapsed={collapsed}
            fresh={fresh}
            revealed={revealed}
            onToggle={(path) =>
              setCollapsed((prev) => {
                const next = new Set(prev);
                if (next.has(path)) next.delete(path);
                else next.add(path);
                return next;
              })
            }
            onOpen={openPath}
          />
        </div>
      )}
      {!treeOnly && (
        <div className={ui.viewerCol}>
          <div className={ui.fileTabs} role="tablist" aria-label={t("workspace.openFilesLabel")}>
            <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn} ${ui.fileTabsToggle}`} onClick={() => setTreeOpen((v) => !v)} aria-label={t(showTree ? "workspace.hideTree" : "workspace.showTree")} aria-pressed={showTree} title={t(showTree ? "workspace.hideTree" : "workspace.showTree")}>
              <SidebarSimple size={15} weight={showTree ? "fill" : "regular"} />
            </button>
            <AnimatePresence initial={false}>
              {tabs.tabs.map((path) => {
                const name = path.split("/").pop() ?? path;
                const parent = path.split("/").slice(-2, -1)[0];
                const selected = path === active;
                return (
                  <motion.div key={path} layout="position" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.14 }} className={`${ui.fileTab} ${selected ? ui.fileTabActive : ""}`} role="tab" aria-selected={selected} title={path} data-el="file-tab">
                    <button type="button" className={ui.fileTabMain} onClick={() => tabs.activate(path)} onAuxClick={(e) => e.button === 1 && tabs.close(path)}>
                      <span className={ui.treeIcon}>{iconFor(path, 13)}</span>
                      <span className={ui.ellipsis}>{name}</span>
                      {(names.get(name) ?? 0) > 1 && parent && <span className={ui.faint} style={{ fontSize: 11 }}>{parent}</span>}
                    </button>
                    <button type="button" className={ui.fileTabClose} onClick={() => tabs.close(path)} aria-label={t("workspace.closeNamed", { name })}><X size={11} /></button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          {active ? (
            <>
              <div className={ui.fileBar}>
                <nav className={ui.breadcrumb} aria-label={t("workspace.filePath")} data-el="breadcrumb">
                  {active.split("/").map((segment, i, all) => {
                    const sub = all.slice(0, i + 1).join("/");
                    const last = i === all.length - 1;
                    return (
                      <span key={sub} className={ui.crumb}>
                        {i > 0 && <CaretRight size={10} className={ui.crumbSep} />}
                        {last ? <b>{segment}</b> : <button type="button" onClick={() => reveal(sub)} title={t("workspace.showInTree", { path: sub })}>{segment}</button>}
                      </span>
                    );
                  })}
                </nav>
                <span className={ui.fileActions}>
                  {hasRenderedView(kind) && typeof doc?.content === "string" && !doc.tooLarge && (
                    <span className={ui.segmented} role="group" aria-label={t("workspace.viewMode")} data-el="view-mode">
                      {(["view", "source"] as const).map((m, i) => (
                        <button key={m} type="button" aria-pressed={mode === m} onClick={() => setModes((all) => ({ ...all, [active]: m }))}>
                          {modeLabels(t, kind, readOnly)[i]}
                        </button>
                      ))}
                    </span>
                  )}
                  {kind === "html" && onOpenInBrowser && (
                    <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} onClick={() => onOpenInBrowser(active)} data-el="open-in-browser"><Browser size={13} /> {t("common.open")}</button>
                  )}
                  {showsEditor && (
                    <span className={ui.saveState} data-el="save-state" style={{ marginLeft: 4 }}>
                      <span className={ui.dot} style={{ color: tabs.saved === "error" ? "var(--w-err)" : tabs.saved === "saving" ? "var(--w-warn)" : tabs.saved === "synced" ? "var(--w-agent)" : "var(--w-ok)" }} />
                      {t(tabs.saved === "saving" ? "workspace.savingShort" : tabs.saved === "error" ? "workspace.notSaved" : tabs.saved === "synced" ? "workspace.updatedOnDisk" : "workspace.savedShort")}
                    </span>
                  )}
                  {readOnly && doc && !doc.missing && <a className={`${ui.btn} ${ui.btnGhost} ${ui.iconBtn}`} href={tabs.source.rawUrl(active, doc.mtime, true)} download aria-label={t("workspace.download")} title={t("workspace.download")}><DownloadSimple size={14} /></a>}
                </span>
              </div>
              <ViewerBody key={active} path={active} doc={doc} mode={mode} readOnly={readOnly} tabs={tabs} generation={generation} onPaste={onPaste} onOpenPath={openPath} />
            </>
          ) : (
            <Placeholder icon={<FileCode size={18} />} title={t("workspace.pickFile")}>
              <span>{t("workspace.pickFileText")}</span>
            </Placeholder>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
