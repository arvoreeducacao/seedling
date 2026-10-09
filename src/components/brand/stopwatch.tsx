"use client";

import styles from "./brand.module.css";
import { Figure, pivot, type FigureProps } from "./figure";
import { useSvgIds } from "./use-brand";

export type StopwatchProps = FigureProps & {
  progress?: number;
  running?: boolean;
  urgent?: boolean;
};

function ringColor(progress: number, urgent: boolean) {
  if (urgent || progress < 0.1) return "#ff8a9b";
  if (progress < 0.25) return "#ffc46b";
  return "#7df9c2";
}

export function Stopwatch({ progress = 1, running = true, urgent = false, size = 96, ...figure }: StopwatchProps) {
  const id = useSvgIds(["case", "face", "rim", "button", "glare"] as const);
  const remaining = Math.min(1, Math.max(0, progress));
  const color = ringColor(remaining, urgent);
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <Figure size={size} ratio={180 / 160} viewBox="0 0 160 180" {...figure}>
      {() => (
        <>
          <defs>
            <radialGradient id={id.case} cx="0.35" cy="0.3" r="0.85">
              <stop offset="0" stopColor="#f1f2ff" />
              <stop offset="0.4" stopColor="#a9aef0" />
              <stop offset="0.85" stopColor="#4a4fa8" />
              <stop offset="1" stopColor="#2c2f78" />
            </radialGradient>
            <radialGradient id={id.face} cx="0.5" cy="0.4" r="0.65">
              <stop offset="0" stopColor="#25285e" />
              <stop offset="1" stopColor="#101136" />
            </radialGradient>
            <linearGradient id={id.rim} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0.55" stopColor="#7df9c2" stopOpacity="0" />
              <stop offset="1" stopColor="#7df9c2" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id={id.button} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e3e5ff" />
              <stop offset="1" stopColor="#5f65c4" />
            </linearGradient>
            <linearGradient id={id.glare} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
              <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className={urgent ? styles.rattle : styles.bobSlow} style={pivot(80, 104)}>
            <rect x="68" y="8" width="24" height="14" rx="5" fill={`url(#${id.button})`} />
            <rect x="74" y="20" width="12" height="16" rx="3" fill="#7d83d6" />
            <g style={{ ...pivot(80, 104), transform: "rotate(42deg)" }}>
              <rect x="73" y="26" width="14" height="12" rx="4" fill={`url(#${id.button})`} />
            </g>
            <circle cx="80" cy="104" r="64" fill={`url(#${id.case})`} />
            <circle cx="80" cy="104" r="63" fill="none" stroke={`url(#${id.rim})`} strokeWidth="3" />
            <circle cx="80" cy="104" r="52" fill={`url(#${id.face})`} />
            {ticks.map((deg) => (
              <line
                key={deg}
                x1="80"
                y1={deg % 90 === 0 ? 58 : 60}
                x2="80"
                y2="64"
                stroke="#babcd9"
                strokeOpacity={deg % 90 === 0 ? 0.9 : 0.45}
                strokeWidth={deg % 90 === 0 ? 3 : 2}
                strokeLinecap="round"
                transform={`rotate(${deg} 80 104)`}
              />
            ))}
            <circle cx="80" cy="104" r="45" fill="none" stroke="#2c2f6e" strokeWidth="5" />
            <circle
              cx="80"
              cy="104"
              r="45"
              fill="none"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${remaining * 100} 100`}
              transform="rotate(-90 80 104)"
              style={{ transition: "stroke-dasharray 600ms ease, stroke 400ms ease" }}
            />
            <g className={running ? styles.spin : undefined} style={{ ...pivot(80, 104), ["--lap" as string]: urgent ? "4s" : "8s" }}>
              <path d="M80 108 L80 70" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="80" cy="70" r="3" fill={color} />
            </g>
            <circle cx="80" cy="104" r="6" fill="#e3e5ff" />
            <circle cx="80" cy="104" r="2.4" fill="#5865f2" />
            <circle cx="80" cy="104" r="52" fill={`url(#${id.glare})`} />
            <path d="M40 80 Q48 60 68 52" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>
        </>
      )}
    </Figure>
  );
}
