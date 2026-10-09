"use client";

import { useId, useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";

export function useSvgIds<const K extends readonly string[]>(keys: K) {
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  return Object.fromEntries(keys.map((key) => [key, `b${base}${key}`])) as { [P in K[number]]: string };
}

export function usePlayback<T extends Element>(animated: boolean) {
  const ref = useRef<T>(null);
  const visible = useInView(ref, { margin: "120px" });
  const reduced = useReducedMotion() ?? false;
  const still = !animated || reduced;
  return { ref, still, paused: still || !visible };
}

export const springIn = { type: "spring", stiffness: 260, damping: 18, mass: 0.8 } as const;
