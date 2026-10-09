"use client";

import styles from "./brand.module.css";
import { pivot } from "./figure";
import { bodyStops, ink, leafStops, rimLight, shadeColor, sproutBodyPath, sproutLeafLeftPath, sproutLeafRightPath, type Stop } from "./paint";
import { usePlayback, useSvgIds } from "./use-brand";

export type LogoProps = {
  variant?: "full" | "mark" | "wordmark";
  size?: number;
  tone?: "light" | "dark";
  animated?: boolean;
  label?: string;
  className?: string;
};

const VIEW = { x: 36, y: 20, w: 128, h: 166 };

function stops(list: readonly Stop[]) {
  return list.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />);
}

export function LogoMark({ size = 32, animated = true }: { size?: number; animated?: boolean }) {
  const id = useSvgIds(["body", "shade", "rim", "leafL", "leafR", "spec", "clip"] as const);
  const { ref, still, paused } = usePlayback<HTMLSpanElement>(animated);
  return (
    <span ref={ref} className={styles.root} data-paused={paused || undefined} data-still={still || undefined}>
      <svg
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
        width={Math.round((size * VIEW.w) / VIEW.h)}
        height={size}
        aria-hidden
        focusable="false"
      >
        <defs>
          <radialGradient id={id.body} cx="0.36" cy="0.3" r="0.82">
            {stops(bodyStops)}
          </radialGradient>
          <linearGradient id={id.shade} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.45" stopColor={shadeColor} stopOpacity="0" />
            <stop offset="1" stopColor={shadeColor} stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={id.rim} x1="0.1" y1="0.1" x2="0.9" y2="0.95">
            <stop offset="0.45" stopColor={rimLight} stopOpacity="0" />
            <stop offset="1" stopColor={rimLight} stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id={id.leafL} x1="1" y1="0.6" x2="0" y2="0.2">
            {stops(leafStops)}
          </linearGradient>
          <linearGradient id={id.leafR} x1="0" y1="0.8" x2="1" y2="0.1">
            {stops(leafStops)}
          </linearGradient>
          <radialGradient id={id.spec} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <clipPath id={id.clip}>
            <path d={sproutBodyPath} />
          </clipPath>
        </defs>
        <g className={styles.sway} style={pivot(100, 80)}>
          <path d="M100 82 C 99 72 101.5 64 100 54" stroke="#3fb57a" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d={sproutLeafLeftPath} fill={`url(#${id.leafL})`} />
          <path d={sproutLeafRightPath} fill={`url(#${id.leafR})`} />
          <path d="M104 52 C 116 42 132 36 148 34" stroke="#e6ffd0" strokeOpacity="0.6" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </g>
        <path d={sproutBodyPath} fill={`url(#${id.body})`} />
        <g clipPath={`url(#${id.clip})`}>
          <rect x="38" y="76" width="124" height="108" fill={`url(#${id.shade})`} />
          <path d={sproutBodyPath} fill="none" stroke={`url(#${id.rim})`} strokeWidth="8" />
        </g>
        <ellipse cx="72" cy="100" rx="18" ry="10.5" fill={`url(#${id.spec})`} transform="rotate(-32 72 100)" />
        <path d="M74 118 L94 134 L74 150" stroke={ink} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="104" y="143" width="28" height="10" rx="5" fill={ink} className={styles.cursor} />
      </svg>
    </span>
  );
}

function LeafDot({ tone }: { tone: "light" | "dark" }) {
  return (
    <svg
      viewBox="0 0 24 20"
      aria-hidden
      focusable="false"
      style={{ position: "absolute", left: "50%", top: "0.02em", width: "0.46em", height: "0.38em", translate: "-38% 0", overflow: "visible" }}
    >
      <path d="M3 18 C 4 8 12 2 22 2 C 21 12 13 18 3 18 Z" fill={tone === "light" ? "#7df9c2" : "#2e9e68"} />
      <path d="M5 16 C 10 11 14 7.5 19 5" stroke={tone === "light" ? "#0e0f2d" : "#e6ffd0"} strokeOpacity="0.35" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Wordmark({ size = 18, tone = "light" }: { size?: number; tone?: "light" | "dark" }) {
  return (
    <span
      aria-hidden
      style={{
        fontFamily: 'var(--font-display, var(--font-unbounded, "Unbounded")), sans-serif',
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.02em",
        color: tone === "light" ? "#ffffff" : "#0e0f2d",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "baseline",
      }}
    >
      seedl
      <span style={{ position: "relative", display: "inline-block" }}>
        <span style={{ display: "inline-block", clipPath: "inset(0.36em -0.1em -0.3em -0.1em)" }}>i</span>
        <LeafDot tone={tone} />
      </span>
      ng
    </span>
  );
}

export function Logo({ variant = "full", size = 32, tone = "light", animated = true, label = "Seedling", className }: LogoProps) {
  const text = Math.round(size * 0.56);
  return (
    <span
      role="img"
      aria-label={label}
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.24), lineHeight: 1 }}
    >
      {variant !== "wordmark" && <LogoMark size={size} animated={animated} />}
      {variant !== "mark" && <Wordmark size={variant === "wordmark" ? size : text} tone={tone} />}
    </span>
  );
}
