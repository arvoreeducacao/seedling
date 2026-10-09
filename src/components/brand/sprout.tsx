"use client";

import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import styles from "./brand.module.css";
import { Figure, pivot, type FigureProps } from "./figure";
import { ink, sproutBodyPath, sproutLeafLeftPath, sproutLeafRightPath } from "./paint";
import { useSvgIds } from "./use-brand";

export const sproutMoods = ["idle", "waving", "thinking", "celebrating", "sleeping", "worried"] as const;

export type SproutMood = (typeof sproutMoods)[number];

export type SproutProps = FigureProps & { mood?: SproutMood };

type Pose = { tilt: number; leftArm: number; rightArm: number; leftLeaf: number; rightLeaf: number };

const poses: Record<SproutMood, Pose> = {
  idle: { tilt: 0, leftArm: 0, rightArm: 0, leftLeaf: 0, rightLeaf: 0 },
  waving: { tilt: -3, leftArm: 0, rightArm: -125, leftLeaf: 4, rightLeaf: -4 },
  thinking: { tilt: -4, leftArm: 0, rightArm: 68, leftLeaf: -6, rightLeaf: 2 },
  celebrating: { tilt: 0, leftArm: 132, rightArm: -132, leftLeaf: 10, rightLeaf: -10 },
  sleeping: { tilt: 5, leftArm: 6, rightArm: -6, leftLeaf: -30, rightLeaf: 28 },
  worried: { tilt: 0, leftArm: -64, rightArm: 64, leftLeaf: -16, rightLeaf: 16 },
};

const BODY = sproutBodyPath;

const confetti = [
  { x: 64, y: 96, dx: "-46px", dy: "-58px", turn: "220deg", c: "#5865f2", d: 0, s: "rect" },
  { x: 136, y: 96, dx: "48px", dy: "-54px", turn: "-260deg", c: "#ffd36b", d: 0.15, s: "rect" },
  { x: 92, y: 74, dx: "-20px", dy: "-74px", turn: "180deg", c: "#7df9c2", d: 0.3, s: "dot" },
  { x: 110, y: 74, dx: "22px", dy: "-70px", turn: "-200deg", c: "#ff8fb1", d: 0.45, s: "rect" },
  { x: 54, y: 120, dx: "-64px", dy: "-20px", turn: "300deg", c: "#c4b5fd", d: 0.6, s: "dot" },
  { x: 146, y: 120, dx: "62px", dy: "-24px", turn: "-320deg", c: "#b6f28a", d: 0.75, s: "rect" },
  { x: 78, y: 84, dx: "-38px", dy: "-80px", turn: "160deg", c: "#ff8fb1", d: 0.9, s: "dot" },
  { x: 124, y: 84, dx: "36px", dy: "-84px", turn: "-140deg", c: "#5865f2", d: 1.05, s: "dot" },
  { x: 100, y: 70, dx: "4px", dy: "-90px", turn: "260deg", c: "#ffd36b", d: 1.2, s: "rect" },
  { x: 60, y: 108, dx: "-56px", dy: "-44px", turn: "-240deg", c: "#7df9c2", d: 1.35, s: "rect" },
] as const;

function rotate(deg: number, x: number, y: number): CSSProperties {
  return { ...pivot(x, y), transform: `rotate(${deg}deg)` };
}

function delayed(seconds: number, x: number, y: number): CSSProperties {
  return { ...pivot(x, y), animationDelay: `${seconds}s` };
}

const faceFade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.22 } };

export function Sprout({ mood = "idle", size = 160, ...figure }: SproutProps) {
  const id = useSvgIds(["body", "shade", "rim", "spec", "belly", "arm", "leafL", "leafR", "stem", "eye", "blush", "ground", "drop", "clip"] as const);
  const pose = poses[mood];
  const sleeping = mood === "sleeping";

  const eye = (cx: number, cy: number, dx = 0, dy = 0, ry = 12) => (
    <g className={styles.blink} style={pivot(cx, cy)}>
      <ellipse cx={cx + dx} cy={cy + dy} rx={9.5} ry={ry} fill={`url(#${id.eye})`} />
      <circle cx={cx + dx + 3.2} cy={cy + dy - 4.4} r={3.6} fill="#fff" />
      <circle cx={cx + dx - 3} cy={cy + dy + 4.6} r={1.6} fill="#fff" opacity={0.7} />
    </g>
  );

  return (
    <Figure size={size} ratio={1} viewBox="0 0 200 200" {...figure}>
      {() => (
        <>
          <defs>
            <radialGradient id={id.body} cx="0.36" cy="0.3" r="0.82">
              <stop offset="0" stopColor="#d4fbb0" />
              <stop offset="0.32" stopColor="#7fe08f" />
              <stop offset="0.72" stopColor="#33a872" />
              <stop offset="1" stopColor="#176258" />
            </radialGradient>
            <linearGradient id={id.shade} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.45" stopColor="#0c3443" stopOpacity="0" />
              <stop offset="1" stopColor="#0c3443" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id={id.rim} x1="0.1" y1="0.1" x2="0.9" y2="0.95">
              <stop offset="0.45" stopColor="#a9b4ff" stopOpacity="0" />
              <stop offset="1" stopColor="#a9b4ff" stopOpacity="0.95" />
            </linearGradient>
            <radialGradient id={id.spec} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={id.belly} cx="0.5" cy="0.45" r="0.5">
              <stop offset="0" stopColor="#f2ffe0" stopOpacity="0.4" />
              <stop offset="1" stopColor="#f2ffe0" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={id.arm} cx="0.4" cy="0.25" r="0.85">
              <stop offset="0" stopColor="#b9f5a4" />
              <stop offset="0.55" stopColor="#4cc07c" />
              <stop offset="1" stopColor="#1d6f5c" />
            </radialGradient>
            <linearGradient id={id.leafL} x1="1" y1="0.6" x2="0" y2="0.2">
              <stop offset="0" stopColor="#2e9e68" />
              <stop offset="0.6" stopColor="#74d982" />
              <stop offset="1" stopColor="#c8f59a" />
            </linearGradient>
            <linearGradient id={id.leafR} x1="0" y1="0.8" x2="1" y2="0.1">
              <stop offset="0" stopColor="#2e9e68" />
              <stop offset="0.55" stopColor="#7be08a" />
              <stop offset="1" stopColor="#d4fbb0" />
            </linearGradient>
            <linearGradient id={id.stem} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#24806a" />
              <stop offset="1" stopColor="#6fd486" />
            </linearGradient>
            <radialGradient id={id.eye} cx="0.5" cy="0.85" r="0.75">
              <stop offset="0" stopColor="#5d55d8" />
              <stop offset="0.55" stopColor="#1f1b52" />
              <stop offset="1" stopColor="#0f0d2e" />
            </radialGradient>
            <radialGradient id={id.blush} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ff8fb1" stopOpacity="0.7" />
              <stop offset="1" stopColor="#ff8fb1" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={id.ground} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#04051a" stopOpacity="0.55" />
              <stop offset="1" stopColor="#04051a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={id.drop} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e4f4ff" />
              <stop offset="1" stopColor="#7cbcff" />
            </linearGradient>
            <clipPath id={id.clip}>
              <path d={BODY} />
            </clipPath>
          </defs>

          <ellipse cx="100" cy="186" rx="50" ry="8" fill={`url(#${id.ground})`} />

          <g className={mood === "celebrating" ? styles.hop : undefined} style={pivot(100, 186)}>
            <g className={mood === "worried" ? styles.shiver : undefined}>
              <g className={styles.pose} style={rotate(pose.tilt, 100, 184)}>
                <ellipse cx="80" cy="179" rx="15" ry="8" fill="#1d6f5c" />
                <ellipse cx="120" cy="179" rx="15" ry="8" fill="#1d6f5c" />
                <ellipse cx="78" cy="176.5" rx="10" ry="4" fill="#4cc07c" opacity="0.7" />
                <ellipse cx="118" cy="176.5" rx="10" ry="4" fill="#4cc07c" opacity="0.7" />

                <g
                  className={styles.breathe}
                  style={{ ...pivot(100, 182), ["--breath" as string]: sleeping ? "6.6s" : "4.8s" }}
                >
                  <g className={sleeping ? styles.swayLate : styles.sway} style={pivot(100, 80)}>
                    <path d="M100 82 C 99 72 101.5 64 100 54" stroke={`url(#${id.stem})`} strokeWidth="6" strokeLinecap="round" fill="none" />
                    <g className={styles.pose} style={rotate(pose.leftLeaf, 100, 56)}>
                      <path d={sproutLeafLeftPath} fill={`url(#${id.leafL})`} />
                      <path d="M97 56 C 84 50 70 46 58 46" stroke="#e6ffd0" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                      <path d="M52 45 C 64 40 82 41 95 52" stroke="#f4ffe6" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                    </g>
                    <g className={styles.pose} style={rotate(pose.rightLeaf, 100, 55)}>
                      <path d={sproutLeafRightPath} fill={`url(#${id.leafR})`} />
                      <path d="M104 52 C 116 42 132 36 148 34" stroke="#e6ffd0" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                      <path d="M108 40 C 122 29 140 27 154 32" stroke="#f4ffe6" strokeOpacity="0.65" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                    </g>
                  </g>

                  <path d={BODY} fill={`url(#${id.body})`} />
                  <g clipPath={`url(#${id.clip})`}>
                    <rect x="38" y="76" width="124" height="108" fill={`url(#${id.shade})`} />
                    <ellipse cx="100" cy="150" rx="34" ry="24" fill={`url(#${id.belly})`} />
                    <path d={BODY} fill="none" stroke={`url(#${id.rim})`} strokeWidth="7" />
                    <path d={BODY} fill="none" stroke="#e8ffd8" strokeOpacity="0.28" strokeWidth="3" transform="translate(2 2)" />
                  </g>
                  <ellipse cx="72" cy="98" rx="17" ry="10" fill={`url(#${id.spec})`} transform="rotate(-32 72 98)" />
                  <circle cx="64" cy="100" r="2.6" fill="#fff" opacity="0.9" />

                  <ellipse cx="66" cy="141" rx="10" ry="6" fill={`url(#${id.blush})`} />
                  <ellipse cx="134" cy="141" rx="10" ry="6" fill={`url(#${id.blush})`} />

                  <AnimatePresence initial={false}>
                    <motion.g key={mood} {...faceFade}>
                      {mood === "idle" && (
                        <>
                          {eye(80, 124)}
                          {eye(120, 124)}
                          <path d="M92 141 Q100 148 108 141" stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
                        </>
                      )}
                      {mood === "waving" && (
                        <>
                          {eye(80, 123)}
                          {eye(120, 123)}
                          <path d="M89 139 Q100 141.5 111 139 Q109.5 153 100 154 Q90.5 153 89 139 Z" fill={ink} />
                          <path d="M94 149.5 Q100 145.5 106 149.5 Q104 154 100 154 Q96 154 94 149.5 Z" fill="#ff7fa3" />
                        </>
                      )}
                      {mood === "thinking" && (
                        <>
                          {eye(80, 124, 3, -3)}
                          {eye(120, 124, 3, -3)}
                          <path d="M112 106 Q120 100 129 104" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
                          <path d="M72 109 Q80 107 88 109" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
                          <path d="M94 146 Q100 143 107 144.5" stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
                        </>
                      )}
                      {mood === "celebrating" && (
                        <>
                          <path d="M70 127 Q80 114 90 127" stroke={ink} strokeWidth="4.6" strokeLinecap="round" fill="none" />
                          <path d="M110 127 Q120 114 130 127" stroke={ink} strokeWidth="4.6" strokeLinecap="round" fill="none" />
                          <path d="M86 137 Q100 140.5 114 137 Q112 159 100 160 Q88 159 86 137 Z" fill={ink} />
                          <path d="M92 153 Q100 147 108 153 Q105 160 100 160 Q95 160 92 153 Z" fill="#ff7fa3" />
                        </>
                      )}
                      {mood === "sleeping" && (
                        <>
                          <path d="M71 125 Q80 132 89 125" stroke={ink} strokeWidth="3.6" strokeLinecap="round" fill="none" />
                          <path d="M111 125 Q120 132 129 125" stroke={ink} strokeWidth="3.6" strokeLinecap="round" fill="none" />
                          <ellipse cx="100" cy="146" rx="3.6" ry="4.6" fill={ink} />
                        </>
                      )}
                      {mood === "worried" && (
                        <>
                          {eye(80, 125, 0, 1, 10.5)}
                          {eye(120, 125, 0, 1, 10.5)}
                          <path d="M69 111 Q78 105 88 103" stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
                          <path d="M112 103 Q122 105 131 111" stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
                          <path d="M89 148 Q94.5 143 100 148 Q105.5 153 111 148" stroke={ink} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </>
                      )}
                    </motion.g>
                  </AnimatePresence>

                  <g className={styles.pose} style={rotate(pose.leftArm, 55, 130)}>
                    <g className={mood === "celebrating" ? styles.wave : undefined} style={pivot(55, 130)}>
                      <ellipse cx="46" cy="147" rx="10" ry="14.5" fill={`url(#${id.arm})`} stroke="#0f4a44" strokeOpacity="0.35" strokeWidth="1.4" transform="rotate(24 46 147)" />
                    </g>
                  </g>
                  <g className={styles.pose} style={rotate(pose.rightArm, 145, 130)}>
                    <g
                      className={mood === "waving" || mood === "celebrating" ? styles.wave : undefined}
                      style={{ ...pivot(145, 130), animationDelay: mood === "celebrating" ? "-0.8s" : undefined }}
                    >
                      <ellipse cx="154" cy="147" rx="10" ry="14.5" fill={`url(#${id.arm})`} stroke="#0f4a44" strokeOpacity="0.35" strokeWidth="1.4" transform="rotate(-24 154 147)" />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>

          <AnimatePresence initial={false}>
            {mood === "thinking" && (
              <motion.g key="thought" {...faceFade}>
                {[
                  [150, 86, 3.6, 0],
                  [161, 68, 5.2, 0.3],
                  [176, 46, 7.4, 0.6],
                ].map(([cx, cy, r, d]) => (
                  <circle key={cx} cx={cx} cy={cy} r={r} fill="#dfe3ff" className={styles.dot} style={delayed(d, cx, cy)} />
                ))}
              </motion.g>
            )}
            {sleeping && (
              <motion.g key="zzz" {...faceFade}>
                {[0, 1.4, 2.8].map((d, i) => (
                  <g key={d} className={styles.zee} style={delayed(d, 146, 92)}>
                    <path
                      d={`M${142 + i * 3} ${88 - i * 2} h${8 + i * 2} l${-(8 + i * 2)} ${9 + i * 2} h${8 + i * 2}`}
                      stroke="#dfe3ff"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </g>
                ))}
              </motion.g>
            )}
            {mood === "worried" && (
              <motion.g key="sweat" {...faceFade}>
                <path className={styles.sweat} d="M145 94 Q150 102 150 106 A5 5 0 0 1 140 106 Q140 102 145 94 Z" fill={`url(#${id.drop})`} />
              </motion.g>
            )}
            {mood === "celebrating" && (
              <motion.g key="confetti" {...faceFade}>
                {confetti.map((p) => (
                  <g
                    key={`${p.x}-${p.y}`}
                    className={styles.confetti}
                    style={{
                      ...delayed(p.d, p.x, p.y),
                      ["--dx" as string]: p.dx,
                      ["--dy" as string]: p.dy,
                      ["--turn" as string]: p.turn,
                    }}
                  >
                    {p.s === "rect" ? (
                      <rect x={p.x - 3} y={p.y - 1.8} width="6" height="3.6" rx="1" fill={p.c} />
                    ) : (
                      <circle cx={p.x} cy={p.y} r="2.6" fill={p.c} />
                    )}
                  </g>
                ))}
              </motion.g>
            )}
          </AnimatePresence>
        </>
      )}
    </Figure>
  );
}
