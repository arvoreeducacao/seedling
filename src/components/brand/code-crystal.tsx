"use client";

import styles from "./brand.module.css";
import { Figure, pivot, type FigureProps } from "./figure";
import { useSvgIds } from "./use-brand";

export const crystalGlyphs = ["braces", "angle", "brackets"] as const;
export const crystalHues = ["violet", "mint", "pink", "amber"] as const;

export type CrystalGlyph = (typeof crystalGlyphs)[number];
export type CrystalHue = (typeof crystalHues)[number];

export type CodeCrystalProps = FigureProps & { glyph?: CrystalGlyph; hue?: CrystalHue; tilt?: number };

const palettes: Record<CrystalHue, [string, string, string, string]> = {
  violet: ["#e4e7ff", "#9aa5ff", "#5865f2", "#262a86"],
  mint: ["#e2fff0", "#8ff5c6", "#2fbf8a", "#0f5f55"],
  pink: ["#ffe6f2", "#ff9fcb", "#e8569a", "#7a2160"],
  amber: ["#fff4d6", "#ffd27a", "#f0a33a", "#8a4a16"],
};

const glyphs: Record<CrystalGlyph, string> = {
  braces: "M52 52 Q45 52 45 59 L45 63 Q45 70 39 70 Q45 70 45 77 L45 81 Q45 88 52 88 M68 52 Q75 52 75 59 L75 63 Q75 70 81 70 Q75 70 75 77 L75 81 Q75 88 68 88",
  angle: "M49 57 L37 70 L49 83 M71 57 L83 70 L71 83 M64 54 L56 86",
  brackets: "M50 53 L42 53 L42 87 L50 87 M70 53 L78 53 L78 87 L70 87",
};

export function CodeCrystal({ glyph = "braces", hue = "violet", tilt = 0, size = 72, ...figure }: CodeCrystalProps) {
  const id = useSvgIds(["face", "left", "right", "top", "core"] as const);
  const [light, mid, base, deep] = palettes[hue];

  return (
    <Figure size={size} ratio={140 / 120} viewBox="0 0 120 140" {...figure}>
      {() => (
        <>
          <defs>
            <linearGradient id={id.face} x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor={mid} />
              <stop offset="1" stopColor={base} />
            </linearGradient>
            <linearGradient id={id.left} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={light} />
              <stop offset="1" stopColor={mid} />
            </linearGradient>
            <linearGradient id={id.right} x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={base} />
              <stop offset="1" stopColor={deep} />
            </linearGradient>
            <linearGradient id={id.top} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor={light} />
            </linearGradient>
            <radialGradient id={id.core} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor={light} stopOpacity="0.7" />
              <stop offset="1" stopColor={light} stopOpacity="0" />
            </radialGradient>
          </defs>
          <g style={{ ...pivot(60, 70), transform: `rotate(${tilt}deg)` }}>
            <g className={styles.drift} style={pivot(60, 70)}>
              <polygon points="60,8 22,40 38,46" fill={`url(#${id.top})`} />
              <polygon points="60,8 98,40 82,46" fill={`url(#${id.left})`} opacity="0.85" />
              <polygon points="60,8 38,46 82,46" fill={light} opacity="0.95" />
              <polygon points="22,40 38,46 42,96 30,100" fill={`url(#${id.left})`} />
              <polygon points="98,40 82,46 78,96 90,100" fill={`url(#${id.right})`} />
              <polygon points="38,46 82,46 78,96 42,96" fill={`url(#${id.face})`} />
              <polygon points="30,100 42,96 78,96 90,100 60,132" fill={`url(#${id.right})`} />
              <polygon points="42,96 78,96 60,132" fill={deep} opacity="0.45" />
              <ellipse cx="60" cy="70" rx="24" ry="24" fill={`url(#${id.core})`} />
              <path d={glyphs[glyph]} stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.95" />
              <path d="M27 44 L33 96" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M60 12 L42 44" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
              <g className={styles.twinkle} style={pivot(92, 26)}>
                <path d="M92 16 Q93.4 24.6 102 26 Q93.4 27.4 92 36 Q90.6 27.4 82 26 Q90.6 24.6 92 16 Z" fill="#ffffff" />
              </g>
            </g>
          </g>
        </>
      )}
    </Figure>
  );
}
