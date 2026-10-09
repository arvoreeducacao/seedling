"use client";

import { useEffect, useState } from "react";
import { CheckCircle, DotsThree, FileCode, Flask, GitDiff, Play, XCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { Keys, ShimmerLines, TaskRow, spring } from "./ai";
import { parseTestLines } from "./test-lines";
import ui from "./ui.module.css";

export type Challenge = { title: string; kind: string; statementHtml: string; flow: { title: string; description?: string }[]; states: string[]; hasPreview: boolean; visibleTestCommand: string | null };
export type TestResult = { output: string; passed: number; total: number };

export { languageOf } from "./file-kinds";

export function stripAnsi(text: string) {
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/\u001b\][^\u0007]*\u0007/g, "");
}

export function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className={ui.empty}>
      <div className={ui.emptyInner}>
        <span className={ui.emptyIcon}>{icon}</span>
        <span style={{ color: "var(--w-fg)", fontWeight: 500, fontSize: 13 }}>{title}</span>
        {children}
      </div>
    </div>
  );
}

export function BriefPanel({ challenge, index, total, playground }: { challenge: Challenge | null; index: number; total: number; playground?: boolean }) {
  if (!challenge) return <Empty icon={<FileCode size={18} />} title="No challenge loaded" />;
  const isScreen = challenge.kind === "screen";
  return (
    <div className={ui.scroll} data-el="brief">
      <div className={ui.section} style={{ borderBottom: "1px solid var(--w-line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {playground ? (
            <span className={ui.sectionLabel}>Free practice · not graded</span>
          ) : (
            <>
              <span className={ui.sectionLabel}>Challenge {String(index + 1).padStart(2, "0")} of {String(total).padStart(2, "0")}</span>
              <span className={ui.chip}>{isScreen ? "UI challenge" : "Code challenge"}</span>
            </>
          )}
        </div>
        <h2 className={ui.briefTitle}>{challenge.title}</h2>
      </div>
      {isScreen && challenge.flow.length > 0 && (
        <div className={ui.section} style={{ paddingBottom: 0 }} data-el="expected-flow">
          <div className={ui.sectionLabel} style={{ marginBottom: 10 }}>Expected flow</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {challenge.flow.map((f, i) => (
              <div key={i} className={ui.flowItem}>
                <span className={ui.flowNum}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{f.title}</div>
                  {f.description && <div className={ui.faint} style={{ marginTop: 2 }}>{f.description}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className={ui.section}>
        <div className={ui.prose} dangerouslySetInnerHTML={{ __html: challenge.statementHtml }} />
        {isScreen && challenge.states.length > 0 && (
          <div className={ui.callout} style={{ marginTop: 14 }} data-el="scored-states">
            <div className={ui.sectionLabel} style={{ marginBottom: 8 }}>States that score</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }} className={ui.muted}>
              {challenge.states.map((s) => (
                <li key={s} style={{ display: "flex", gap: 8 }}><CheckCircle size={14} style={{ color: "var(--w-fg-3)", flex: "none", marginTop: 2 }} />{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function TestsPanel({ command, result, running, onRun }: { command: string | null; result: TestResult | null; running: boolean; onRun: () => void }) {
  if (!command) return <Empty icon={<Flask size={18} />} title="No visible tests">This challenge is graded by hidden checks after you submit.</Empty>;
  const all = result && result.total > 0 && result.passed === result.total;
  const pct = result && result.total ? (result.passed / result.total) * 100 : 0;
  return (
    <div className={ui.panelBody} data-el="tests">
      <div className={ui.cmd}>
        <span className={ui.prompt}>$</span>
        <span className={ui.ellipsis} style={{ flex: 1 }} title={command}>{command}</span>
        <button type="button" className={`${ui.btn} ${ui.btnSm}`} onClick={onRun} disabled={running} data-el="run-tests">
          <Play size={12} weight="fill" /> {running ? "Running" : "Run"} <Keys keys={["mod", "enter"]} />
        </button>
      </div>
      {result && !running && (
        <div className={ui.testSummary}>
          <span style={{ color: all ? "var(--w-ok)" : "var(--w-warn)", display: "flex" }}>{all ? <CheckCircle size={22} weight="fill" /> : <XCircle size={22} weight="fill" />}</span>
          <span className={ui.testScore}>{result.passed}<span className={ui.faint} style={{ fontSize: 16 }}>/{result.total}</span></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={ui.faint} style={{ fontSize: 11.5, marginBottom: 6 }}>{all ? "All visible tests pass" : `${result.total - result.passed} failing`}</div>
            <div className={ui.testBar}>
              <i style={{ width: `${pct}%`, background: "var(--w-ok)" }} />
              <i style={{ width: `${100 - pct}%`, background: result.total ? "var(--w-err)" : "transparent", opacity: 0.6 }} />
            </div>
          </div>
        </div>
      )}
      <div className={ui.scroll}>
        {running ? (
          <div>
            <TaskRow status="running" label={`Running ${command}`} />
            <div style={{ padding: "16px" }}><ShimmerLines lines={4} /></div>
          </div>
        ) : result ? (
          <TestResultView output={result.output} />
        ) : (
          <Empty icon={<Flask size={18} />} title="Run the visible tests">They run in the same sandbox as the agent. Hidden tests run when you submit.</Empty>
        )}
      </div>
    </div>
  );
}

function TestResultView({ output }: { output: string }) {
  const lines = parseTestLines(output);
  const ordered = [...lines.filter((l) => !l.passed), ...lines.filter((l) => l.passed)];
  if (!lines.length) return <pre className={ui.output}>{stripAnsi(output) || "(no output)"}</pre>;
  return (
    <div data-el="test-rows">
      {ordered.map((l, i) => (
        <motion.div key={`${l.name}-${l.passed}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
          <TaskRow status={l.passed ? "done" : "failed"} label={l.name} meta={l.meta} />
        </motion.div>
      ))}
      <details className={ui.rawOutput}>
        <summary>Raw output</summary>
        <pre className={ui.output}>{stripAnsi(output)}</pre>
      </details>
    </div>
  );
}

export type FileChange = { path: string; status: "added" | "modified" | "deleted"; added: number; removed: number; hunks: { lines: { kind: "context" | "add" | "del"; text: string; oldNo: number | null; newNo: number | null }[] }[]; skipped: "binary" | "large" | null };

const statusMark = { added: { letter: "A", color: "var(--w-ok)" }, modified: { letter: "M", color: "var(--w-warn)" }, deleted: { letter: "D", color: "var(--w-err)" } } as const;
const MAX_RENDERED_LINES = 1200;

export function useChanges(url: string | null, active: boolean) {
  const [changes, setChanges] = useState<FileChange[] | null>(null);
  useEffect(() => {
    setChanges(null);
    if (!url) return;
    let alive = true;
    const load = async () => {
      const res = await fetch(url, { cache: "no-store" }).catch(() => null);
      if (!res?.ok || !alive) return;
      const json = await res.json();
      if (alive) setChanges(json.changes ?? []);
    };
    void load();
    const timer = setInterval(load, active ? 4000 : 12000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [url, active]);
  return changes;
}

function Churn({ added, removed }: { added: number; removed: number }) {
  const total = added + removed || 1;
  const green = Math.round((added / total) * 5);
  return (
    <span style={{ display: "inline-flex", gap: 2 }} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} style={{ width: 6, height: 6, borderRadius: 2, background: i < green ? "var(--w-ok)" : i < 5 && removed > 0 ? "var(--w-err)" : "var(--w-active)", opacity: 0.85 }} />
      ))}
    </span>
  );
}

export function ChangesPanel({ changes, onOpen, who }: { changes: FileChange[] | null; onOpen?: (path: string) => void; who?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (!changes) return <div className={ui.empty}><span className={ui.spinner} /></div>;
  if (!changes.length) return <Empty icon={<GitDiff size={18} />} title="No changes yet">{`Every file ${who ?? "you"} or the agent changes shows up here as a diff against the original challenge.`}</Empty>;
  const current = changes.find((c) => c.path === selected) ?? changes[0];
  let budget = MAX_RENDERED_LINES;
  return (
    <div className={ui.panelBody} data-el="changes">
      <div style={{ maxHeight: "38%", overflowY: "auto", flex: "none", borderBottom: "1px solid var(--w-line)" }}>
        <AnimatePresence initial={false}>
          {changes.map((c) => (
            <motion.button layout key={c.path} type="button" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring} className={`${ui.changeRow} ${c.path === current.path ? ui.changeRowActive : ""}`} onClick={() => setSelected(c.path)} title={c.path} data-el="changed-file">
              <span className={ui.changeStatus} style={{ color: statusMark[c.status].color }}>{statusMark[c.status].letter}</span>
              <span className={ui.ellipsis} style={{ flex: 1 }}>{c.path}</span>
              {c.skipped ? <span className={ui.faint}>{c.skipped}</span> : (
                <span key={`${c.added}:${c.removed}`} className={ui.flash} style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 6, padding: "0 4px" }}>
                  {c.added > 0 && <span style={{ color: "var(--w-ok)" }}>+{c.added}</span>}
                  {c.removed > 0 && <span style={{ color: "var(--w-err)" }}>−{c.removed}</span>}
                  <Churn added={c.added} removed={c.removed} />
                </span>
              )}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      <div className={ui.fileBar} style={{ paddingLeft: 16 }}>
        <span className={ui.crumbs} title={current.path}><bdi>{current.path}</bdi></span>
        {onOpen && current.status !== "deleted" && !current.skipped && (
          <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} style={{ marginLeft: "auto" }} onClick={() => onOpen(current.path)}>Open in editor</button>
        )}
      </div>
      <div className={ui.scroll} style={{ overflowX: "auto", background: "var(--w-bg)" }} data-el="diff">
        {current.skipped ? (
          <Empty icon={<GitDiff size={18} />} title={current.skipped === "binary" ? "Binary file" : "File too large to diff"} />
        ) : (
          <div className={ui.diff}>
            {current.hunks.map((h, hi) => (
              <div key={hi}>
                {hi > 0 && <div className={ui.hunkGap}><DotsThree size={14} weight="bold" /></div>}
                {h.lines.map((l, li) => {
                  if (budget-- <= 0) return null;
                  return (
                    <div key={li} className={`${ui.diffLine} ${l.kind === "add" ? ui.diffAdd : l.kind === "del" ? ui.diffDel : ""}`}>
                      <span className={ui.diffNo}>{l.kind === "del" ? l.oldNo : l.newNo}</span>
                      <span className={ui.diffSign}>{l.kind === "add" ? "+" : l.kind === "del" ? "−" : " "}</span>
                      <span>{l.text}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            {budget < 0 && <div className={ui.hunkGap}>Diff truncated. Open the file to see the rest.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
