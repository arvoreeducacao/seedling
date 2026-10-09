export type Placement =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

export type ActorFrame = {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  translate: string;
  enterFrom: { x: number; y: number };
};

const RISE = 28;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function actorFrame(at: Placement, out = 0.5, inset = 24): ActorFrame {
  const o = `${clamp01(out) * 100}%`;
  const edgeInset = `${inset}px`;
  switch (at) {
    case "top":
      return { top: "0", left: "50%", translate: `-50% -${o}`, enterFrom: { x: 0, y: RISE } };
    case "top-left":
      return { top: "0", left: edgeInset, translate: `0 -${o}`, enterFrom: { x: 0, y: RISE } };
    case "top-right":
      return { top: "0", right: edgeInset, translate: `0 -${o}`, enterFrom: { x: 0, y: RISE } };
    case "bottom":
      return { bottom: "0", left: "50%", translate: `-50% ${o}`, enterFrom: { x: 0, y: -RISE } };
    case "bottom-left":
      return { bottom: "0", left: edgeInset, translate: `0 ${o}`, enterFrom: { x: 0, y: -RISE } };
    case "bottom-right":
      return { bottom: "0", right: edgeInset, translate: `0 ${o}`, enterFrom: { x: 0, y: -RISE } };
    case "left":
      return { left: "0", top: "50%", translate: `-${o} -50%`, enterFrom: { x: RISE, y: 0 } };
    case "right":
      return { right: "0", top: "50%", translate: `${o} -50%`, enterFrom: { x: -RISE, y: 0 } };
  }
}

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Star = { x: number; y: number; r: number; o: number };

export function scatterStars(seed: number, count: number, width = 1600, height = 900): Star[] {
  const next = seededRandom(seed);
  const round = (value: number) => Math.round(value * 10) / 10;
  return Array.from({ length: count }, () => {
    const size = next();
    return {
      x: round(next() * width),
      y: round(next() * height),
      r: round(0.6 + size * size * 1.6),
      o: Math.round((0.35 + next() * 0.65) * 100) / 100,
    };
  });
}
