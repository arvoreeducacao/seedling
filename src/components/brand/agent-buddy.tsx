"use client";

import { AnimatePresence, motion } from "motion/react";
import styles from "./brand.module.css";
import { Figure, pivot, type FigureProps } from "./figure";
import { useSvgIds } from "./use-brand";

export const agentStates = ["idle", "working", "done", "error"] as const;

export type AgentState = (typeof agentStates)[number];

export type AgentBuddyProps = FigureProps & { state?: AgentState };

const glow: Record<AgentState, string> = {
  idle: "#7df9c2",
  working: "#9aa6ff",
  done: "#7df9c2",
  error: "#ff8a9b",
};

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } };

export function AgentBuddy({ state = "idle", size = 140, ...figure }: AgentBuddyProps) {
  const id = useSvgIds(["shell", "shellRim", "screen", "glare", "bulb", "halo", "hover", "torso", "ear", "clip"] as const);
  const color = glow[state];
  const working = state === "working";

  return (
    <Figure size={size} ratio={1} viewBox="0 0 200 200" {...figure}>
      {() => (
        <>
          <defs>
            <linearGradient id={id.shell} x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#f1f2ff" />
              <stop offset="0.35" stopColor="#b9bef4" />
              <stop offset="0.8" stopColor="#6a70cf" />
              <stop offset="1" stopColor="#3d418f" />
            </linearGradient>
            <linearGradient id={id.shellRim} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0.5" stopColor="#7df9c2" stopOpacity="0" />
              <stop offset="1" stopColor="#7df9c2" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id={id.screen} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1d1f4e" />
              <stop offset="1" stopColor="#0a0b24" />
            </linearGradient>
            <linearGradient id={id.glare} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={id.bulb} cx="0.35" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.45" stopColor={color} />
              <stop offset="1" stopColor="#3b44c4" />
            </radialGradient>
            <radialGradient id={id.halo} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor={color} stopOpacity="0.55" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={id.hover} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#5865f2" stopOpacity="0.6" />
              <stop offset="1" stopColor="#5865f2" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={id.torso} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9da3ea" />
              <stop offset="1" stopColor="#3b3f8c" />
            </linearGradient>
            <linearGradient id={id.ear} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d6d9ff" />
              <stop offset="1" stopColor="#5157b4" />
            </linearGradient>
            <clipPath id={id.clip}>
              <rect x="58" y="62" width="84" height="62" rx="15" />
            </clipPath>
          </defs>

          <ellipse cx="100" cy="186" rx="44" ry="8" fill={`url(#${id.hover})`} className={styles.pulse} />

          <g className={styles.bob} style={pivot(100, 120)}>
            <g className={styles.bobSlow} style={{ ...pivot(48, 158), animationDelay: "-1.2s" }}>
              <circle cx="48" cy="158" r="10" fill={`url(#${id.ear})`} />
              <circle cx="45" cy="155" r="3" fill="#fff" opacity="0.6" />
            </g>
            <g className={styles.bobSlow} style={{ ...pivot(152, 158), animationDelay: "-3s" }}>
              <circle cx="152" cy="158" r="10" fill={`url(#${id.ear})`} />
              <circle cx="149" cy="155" r="3" fill="#fff" opacity="0.6" />
            </g>

            <rect x="72" y="138" width="56" height="32" rx="14" fill={`url(#${id.torso})`} />
            <rect x="86" y="150" width="28" height="6" rx="3" fill={color} opacity="0.75" className={working ? styles.pulseFast : styles.pulse} />

            <path d="M100 48 L100 30" stroke="#aeb3f0" strokeWidth="4" strokeLinecap="round" />
            <circle cx="100" cy="24" r="14" fill={`url(#${id.halo})`} className={working ? styles.pulseFast : styles.pulse} />
            <circle cx="100" cy="24" r="6.5" fill={`url(#${id.bulb})`} />

            <rect x="32" y="82" width="14" height="30" rx="7" fill={`url(#${id.ear})`} />
            <rect x="154" y="82" width="14" height="30" rx="7" fill={`url(#${id.ear})`} />

            <rect x="42" y="46" width="116" height="96" rx="28" fill={`url(#${id.shell})`} />
            <rect x="42" y="46" width="116" height="96" rx="28" fill="none" stroke={`url(#${id.shellRim})`} strokeWidth="3" />
            <path d="M62 52 Q100 46 138 52" stroke="#fff" strokeOpacity="0.75" strokeWidth="3" strokeLinecap="round" fill="none" />

            <rect x="56" y="60" width="88" height="66" rx="17" fill="#2a2d6b" />
            <rect x="58" y="62" width="84" height="62" rx="15" fill={`url(#${id.screen})`} />

            <g clipPath={`url(#${id.clip})`}>
              <AnimatePresence initial={false}>
                <motion.g key={state} {...fade}>
                  {(state === "idle" || state === "working") && (
                    <g className={working ? styles.look : undefined}>
                      <g className={styles.blink} style={pivot(84, 86)}>
                        <rect x="77" y="76" width="13" height="20" rx="6.5" fill={color} />
                        <rect x="79.5" y="79" width="4" height="6" rx="2" fill="#fff" opacity="0.7" />
                      </g>
                      <g className={styles.blink} style={pivot(116, 86)}>
                        <rect x="110" y="76" width="13" height="20" rx="6.5" fill={color} />
                        <rect x="112.5" y="79" width="4" height="6" rx="2" fill="#fff" opacity="0.7" />
                      </g>
                    </g>
                  )}
                  {state === "done" && (
                    <>
                      <path d="M76 90 Q83.5 79 91 90" stroke={color} strokeWidth="4.5" strokeLinecap="round" fill="none" />
                      <path d="M109 90 Q116.5 79 124 90" stroke={color} strokeWidth="4.5" strokeLinecap="round" fill="none" />
                    </>
                  )}
                  {state === "error" && (
                    <>
                      <path d="M78 79 L90 91 M90 79 L78 91" stroke={color} strokeWidth="4" strokeLinecap="round" />
                      <path d="M110 79 L122 91 M122 79 L110 91" stroke={color} strokeWidth="4" strokeLinecap="round" />
                    </>
                  )}

                  {state === "working" ? (
                    <>
                      <rect x="68" y="104" width="36" height="4" rx="2" fill="#9aa6ff" opacity="0.8" className={styles.typing} style={pivot(68, 106)} />
                      <rect x="68" y="112" width="50" height="4" rx="2" fill="#7df9c2" opacity="0.55" className={styles.typing} style={{ ...pivot(68, 114), animationDelay: "-1.2s" }} />
                    </>
                  ) : state === "done" ? (
                    <path d="M90 108 Q100 116 110 108" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none" />
                  ) : state === "error" ? (
                    <path d="M90 112 Q100 105 110 112" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none" />
                  ) : (
                    <>
                      <path d="M68 110 L73 114 L68 118" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85" />
                      <rect x="77" y="112" width="9" height="4" rx="1" fill={color} className={styles.cursor} />
                    </>
                  )}
                </motion.g>
              </AnimatePresence>
              <rect x="58" y="62" width="84" height="62" rx="15" fill={`url(#${id.glare})`} />
            </g>
          </g>
        </>
      )}
    </Figure>
  );
}
