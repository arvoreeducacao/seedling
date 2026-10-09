"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import styles from "./brand.module.css";
import { springIn, usePlayback } from "./use-brand";

export type FigureProps = {
  size?: number;
  animated?: boolean;
  appear?: boolean;
  delay?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
};

type Props = FigureProps & {
  ratio: number;
  viewBox: string;
  children: (still: boolean) => ReactNode;
};

export function pivot(x: number, y: number): CSSProperties {
  return { transformBox: "view-box", transformOrigin: `${x}px ${y}px` };
}

export function Figure({ size = 160, ratio, viewBox, animated = true, appear = true, delay = 0, label, className, style, children }: Props) {
  const { ref, still, paused } = usePlayback<HTMLDivElement>(animated);
  const width = size;
  const height = Math.round(size * ratio);
  return (
    <motion.div
      ref={ref}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={{ width, height, ...style }}
      data-paused={paused || undefined}
      data-still={still || undefined}
      initial={appear && !still ? { opacity: 0, scale: 0.7, y: 12 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...springIn, delay }}
    >
      <svg
        viewBox={viewBox}
        width={width}
        height={height}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        focusable="false"
      >
        {children(still)}
      </svg>
    </motion.div>
  );
}
