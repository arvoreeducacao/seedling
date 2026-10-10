"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileText, Lightning, Plug, Toolbox, Warning } from "@phosphor-icons/react";
import type { SetupView } from "@/lib/setup/store";
import ui from "@/components/workspace/ui.module.css";
import { useI18n } from "@/components/i18n";
import { hasKey } from "@/lib/i18n";
import css from "./setup.module.css";

export function SetupIndicator({ token }: { token: string }) {
  const { t } = useI18n();
  const [install, setInstall] = useState<SetupView["lastInstall"]>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/s/${token}/setup`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => alive && setInstall(json?.setup?.lastInstall ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);

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

  if (!install) return null;
  const count = install.skills.length + install.mcpServers.length + (install.claudeMd ? 1 : 0);

  return (
    <div className={css.indicator} ref={box} data-el="setup-indicator">
      <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setAnchor({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
          setOpen((v) => !v);
        }} aria-expanded={open} title={t("setup.indicator.title")}>
        {install.error ? <Warning size={12} color="var(--w-warn)" /> : <Toolbox size={12} />} {t("setup.indicator.label")} <span className={ui.mono} style={{ color: "var(--w-fg-4)", fontSize: 11 }}>{count}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }} className={css.popover} style={anchor ? { top: anchor.top, right: anchor.right } : undefined} role="dialog" aria-label={t("setup.indicator.label")}>
            <div className={ui.sectionLabel}>{t("setup.indicator.head")}</div>
            {install.error && <div className={css.popoverRow} style={{ color: "var(--w-warn)" }}><Warning size={13} /><span>{hasKey(install.error) ? t(install.error) : install.error} {t("setup.indicator.worksWithout")}</span></div>}
            {install.skills.length > 0 && <div className={css.popoverRow}><Lightning size={13} /><span><b>{t("setup.skills.title")}</b> {t("setup.indicator.inSkillsDir")} {install.skills.join(", ")}</span></div>}
            {install.claudeMd && <div className={css.popoverRow}><FileText size={13} /><span><b>CLAUDE.md</b> {t("setup.indicator.claudeMdPath")}</span></div>}
            {install.mcpServers.length > 0 && <div className={css.popoverRow}><Plug size={13} /><span><b>{t("setup.mcp.title")}</b>: {install.mcpServers.join(", ")}</span></div>}
            <div className={ui.faint} style={{ fontSize: 11.5, lineHeight: 1.5 }}>{t("setup.indicator.sharedTabs")}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
