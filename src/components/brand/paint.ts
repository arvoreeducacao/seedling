export const ink = "#16213b";

export const sproutBodyPath = "M100 78 C 137 78 160 104 160 134 C 160 164 134 182 100 182 C 66 182 40 164 40 134 C 40 104 63 78 100 78 Z";
export const sproutLeafLeftPath = "M100 57 C 88 40 66 36 50 44 C 60 62 84 68 100 57 Z";
export const sproutLeafRightPath = "M100 55 C 110 32 138 24 156 32 C 148 54 122 64 100 55 Z";

export type Stop = readonly [offset: number, color: string];

export const bodyStops: readonly Stop[] = [
  [0, "#d4fbb0"],
  [0.32, "#7fe08f"],
  [0.72, "#33a872"],
  [1, "#176258"],
];

export const leafStops: readonly Stop[] = [
  [0, "#2e9e68"],
  [0.55, "#7be08a"],
  [1, "#d4fbb0"],
];

export const rimLight = "#a9b4ff";
export const shadeColor = "#0c3443";

export const palette = {
  page: "#0e0f2d",
  surface: "#13143a",
  raised: "#1a1c44",
  high: "#202352",
  muted: "#babcd9",
  accent: "#5865f2",
  mint: "#7df9c2",
  ink,
} as const;
