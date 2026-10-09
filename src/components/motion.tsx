"use client";

import Link from "next/link";
import { animate, motion, MotionConfig, useInView, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

export const spring = { type: "spring", stiffness: 520, damping: 38, mass: 0.7 } as const;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function PageEnter({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }} style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
      {children}
    </motion.div>
  );
}

export function Ticker({ value, format = "int", duration = 0.9 }: { value: number; format?: "int" | "money"; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const render = (n: number) => (format === "money" ? `$${n.toFixed(2)}` : String(Math.round(n)));
  const [text, setText] = useState(render(reduce ? value : 0));
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setText(render(value));
      return;
    }
    const controls = animate(0, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (n) => setText(render(n)) });
    return () => controls.stop();
  }, [inView, value, reduce]);
  return <span ref={ref} className="num">{text}</span>;
}

export type SegItem = { href: string; label: React.ReactNode; count?: number; active: boolean };

export function SegNav({ items, ariaLabel }: { items: SegItem[]; ariaLabel: string }) {
  const id = useId();
  return (
    <nav aria-label={ariaLabel} className="seg seg-glide">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} scroll={false}>
          {item.active && <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={spring} />}
          <span className="seg-label">{item.label}{item.count !== undefined && <span className="count">{item.count}</span>}</span>
        </Link>
      ))}
    </nav>
  );
}

export function SegButtons<T extends string>({ value, onChange, options, ariaLabel, block }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; ariaLabel: string; block?: boolean }) {
  const id = useId();
  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length;
    onChange(options[next].value);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  }
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`seg seg-glide ${block ? "seg-block" : ""}`}>
      {options.map((o, i) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} tabIndex={o.value === value ? 0 : -1} onClick={() => onChange(o.value)} onKeyDown={(e) => onKey(e, i)}>
          {o.value === value && <motion.span layoutId={`segb-${id}`} className="seg-pill" transition={spring} />}
          <span className="seg-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, tone }: { value: number; tone?: string }) {
  return (
    <div className="bar" style={{ height: 6 }}>
      <motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(2, Math.min(100, value))}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} style={{ background: tone }} />
    </div>
  );
}
