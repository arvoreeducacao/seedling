"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { actorFrame, type Placement } from "./geometry";
import { springIn } from "./use-brand";

export type ActorProps = {
  at: Placement;
  out?: number;
  inset?: number;
  behind?: boolean;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export function Actor({ at, out = 0.5, inset = 24, behind = false, delay = 0.15, className, style, children }: ActorProps) {
  const reduced = useReducedMotion() ?? false;
  const { enterFrom, translate, ...edges } = actorFrame(at, out, inset);
  return (
    <div
      className={className}
      style={{ position: "absolute", ...edges, translate, zIndex: behind ? -1 : 2, pointerEvents: "none", lineHeight: 0, ...style }}
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, ...enterFrom }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ ...springIn, delay }}
      >
        {children}
      </motion.div>
    </div>
  );
}
