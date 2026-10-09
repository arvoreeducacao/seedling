"use client";

import { useMemo, type CSSProperties } from "react";
import styles from "./brand.module.css";
import { scatterStars } from "./geometry";
import { usePlayback } from "./use-brand";

export type StarfieldProps = {
  stars?: number;
  seed?: number;
  aurora?: boolean;
  shooting?: boolean;
  animated?: boolean;
  className?: string;
  style?: CSSProperties;
};

const layers = [
  { glimmer: "6.5s", delay: "0s" },
  { glimmer: "9s", delay: "-3s" },
  { glimmer: "12s", delay: "-7s" },
];

const blobs: CSSProperties[] = [
  { left: "-12%", top: "-35%", width: "70%", background: "radial-gradient(closest-side, rgba(88, 101, 242, 0.34), rgba(88, 101, 242, 0))", ["--drift" as string]: "34s", ["--ax" as string]: "8%", ["--ay" as string]: "6%" },
  { right: "-18%", top: "-5%", width: "58%", background: "radial-gradient(closest-side, rgba(45, 212, 191, 0.13), rgba(45, 212, 191, 0))", ["--drift" as string]: "42s", ["--ax" as string]: "-7%", ["--ay" as string]: "5%" },
  { left: "22%", bottom: "-55%", width: "64%", background: "radial-gradient(closest-side, rgba(192, 132, 252, 0.18), rgba(192, 132, 252, 0))", ["--drift" as string]: "48s", ["--ax" as string]: "5%", ["--ay" as string]: "-6%" },
];

const sparkles = [
  { x: 220, y: 140, s: 1.1, d: "0s" },
  { x: 1340, y: 210, s: 0.9, d: "-1.4s" },
  { x: 980, y: 90, s: 0.7, d: "-2.2s" },
  { x: 460, y: 700, s: 0.8, d: "-0.6s" },
  { x: 1480, y: 760, s: 1, d: "-2.8s" },
];

export function Starfield({ stars = 150, seed = 11, aurora = true, shooting = true, animated = true, className, style }: StarfieldProps) {
  const { ref, still, paused } = usePlayback<HTMLDivElement>(animated);
  const sky = useMemo(() => scatterStars(seed, stars), [seed, stars]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={[styles.sky, className].filter(Boolean).join(" ")}
      style={style}
      data-paused={paused || undefined}
      data-still={still || undefined}
    >
      {aurora &&
        blobs.map((blob, i) => <div key={i} className={styles.aurora} style={{ aspectRatio: "1", ...blob }} />)}
      {layers.map((layer, index) => (
        <svg
          key={index}
          className={`${styles.layer} ${styles.glimmer}`}
          style={{ ["--glimmer" as string]: layer.glimmer, animationDelay: layer.delay }}
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid slice"
        >
          {sky
            .filter((_, i) => i % layers.length === index)
            .map((star, i) => (
              <circle key={i} cx={star.x} cy={star.y} r={star.r} fill="#e6e8ff" opacity={star.o} />
            ))}
        </svg>
      ))}
      <svg className={styles.layer} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        {sparkles.map((spark) => (
          <g key={spark.x} transform={`translate(${spark.x} ${spark.y}) scale(${spark.s})`}>
            <path
              className={styles.twinkle}
              style={{ transformBox: "fill-box", transformOrigin: "center", animationDelay: spark.d }}
              d="M0 -9 Q1.2 -1.2 9 0 Q1.2 1.2 0 9 Q-1.2 1.2 -9 0 Q-1.2 -1.2 0 -9 Z"
              fill="#ffffff"
            />
          </g>
        ))}
      </svg>
      {shooting && <div className={styles.shooting} />}
    </div>
  );
}
