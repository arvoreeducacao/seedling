"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, CircleNotch, Command, FileText, KeyReturn, Globe, ListChecks, MagnifyingGlass, PencilSimple, Robot, Terminal as TerminalGlyph, Wrench, XCircle } from "@phosphor-icons/react";
import ui from "./ui.module.css";

export const spring = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;

export function Appear({ children, delay = 0, y = 8, className, style }: { children: React.ReactNode; delay?: number; y?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div className={className} style={style} initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

export function Shimmer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`${ui.shimmer} ${className ?? ""}`}>{children}</span>;
}

export function ShimmerLines({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={ui.skeleton} style={{ width: `${88 - i * 18}%` }} />
      ))}
    </div>
  );
}

export function Thinking({ label = "Thinking" }: { label?: string }) {
  return (
    <span className={ui.thinking} role="status">
      <span className={ui.thinkingDots} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.i key={i} animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </span>
      <Shimmer>{label}</Shimmer>
    </span>
  );
}

const toolIcons: [RegExp, React.ComponentType<{ size?: number }>][] = [
  [/^(read|notebookread)$/i, FileText],
  [/^(edit|multiedit|write|update|notebookedit)$/i, PencilSimple],
  [/^(bash|bashoutput|killshell)$/i, TerminalGlyph],
  [/^(glob|grep|ls|search)$/i, MagnifyingGlass],
  [/^web/i, Globe],
  [/^(todowrite|task)$/i, ListChecks],
  [/agent/i, Robot],
];

export function ToolChip({ name }: { name: string }) {
  const Icon = toolIcons.find(([re]) => re.test(name))?.[1] ?? Wrench;
  return (
    <span className={ui.toolChip}>
      <Icon size={11} />
      {name}
    </span>
  );
}

export type TaskStatus = "done" | "failed" | "running" | "pending";

export function TaskRow({ status, label, meta }: { status: TaskStatus; label: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <motion.div layout className={ui.taskRow} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={spring}>
      <span className={ui.taskIcon} data-status={status}>
        {status === "done" ? <CheckCircle size={15} weight="fill" /> : status === "failed" ? <XCircle size={15} weight="fill" /> : status === "running" ? <motion.span style={{ display: "inline-flex" }} animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}><CircleNotch size={15} weight="bold" /></motion.span> : <span className={ui.taskPending} />}
      </span>
      <span className={ui.ellipsis} style={{ flex: 1 }}>{status === "running" ? <Shimmer>{label}</Shimmer> : label}</span>
      {meta && <span className={ui.taskMeta}>{meta}</span>}
    </motion.div>
  );
}

export function TabIndicator({ id }: { id: string }) {
  return <motion.span layoutId={id} className={ui.tabIndicator} transition={spring} />;
}

export function Keys({ keys }: { keys: ("mod" | "enter" | string)[] }) {
  return (
    <span className={ui.kbd} style={{ display: "inline-flex", alignItems: "center", gap: 2 }} aria-label={keys.map((k) => (k === "mod" ? "Command" : k === "enter" ? "Enter" : k)).join(" ")}>
      {keys.map((k, i) => (k === "mod" ? <Command key={i} size={10} weight="bold" /> : k === "enter" ? <KeyReturn key={i} size={11} weight="bold" /> : <span key={i}>{k}</span>))}
    </span>
  );
}

export { AnimatePresence, motion };
