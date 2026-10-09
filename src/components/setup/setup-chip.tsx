"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileText, Lightning, Plug, Toolbox } from "@phosphor-icons/react";
import type { SetupView } from "@/lib/setup/store";
import ui from "@/components/workspace/ui.module.css";
import css from "./setup.module.css";

export function SetupChip({ view }: { view: SetupView }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = view.skills.length + view.mcpServers.length + (view.claudeMd ? 1 : 0);
  if (!count) return null;

  return (
    <div className={css.indicator} ref={box} data-el="admin-setup-chip">
      <button
        type="button"
        className={ui.chip}
        style={{ cursor: "pointer", border: "none" }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setAnchor({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        title="The skills, CLAUDE.md and MCP servers the candidate brought"
      >
        <Toolbox size={12} /> Their setup <span className={ui.mono} style={{ color: "var(--w-fg-4)" }}>{count}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }} className={css.popover} style={anchor ? { top: anchor.top, right: anchor.right, width: 360 } : undefined} role="dialog" aria-label="Candidate setup">
            <div className={ui.sectionLabel}>Brought by the candidate</div>
            {view.skills.map((s) => (
              <div key={`s-${s.name}`} className={css.popoverRow}><Lightning size={13} /><span><span className={ui.mono}>{s.name}</span>{s.description ? <span className={ui.faint}> · {s.description}</span> : null}</span></div>
            ))}
            {view.claudeMd && <div className={css.popoverRow}><FileText size={13} /><span>CLAUDE.md <span className={ui.faint}>· {(view.claudeMd.size / 1024).toFixed(1)} KB</span></span></div>}
            {view.mcpServers.map((m) => (
              <div key={`m-${m.name}`} className={css.popoverRow}><Plug size={13} /><span style={{ minWidth: 0, overflowWrap: "anywhere" }}><span className={ui.mono}>{m.name}</span> <span className={ui.faint}>{m.type} · {m.url}{m.headers.length ? ` · ${m.headers.map((h) => `${h}: ••••••`).join(", ")}` : ""}</span></span></div>
            ))}
            {view.lastInstall?.error && <div className={ui.faint} style={{ color: "var(--w-warn)" }}>{view.lastInstall.error}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
