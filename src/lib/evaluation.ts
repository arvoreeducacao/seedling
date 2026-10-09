export const criteria = [
  { key: "dado", label: "Read the data" },
  { key: "ia", label: "Checked the AI" },
  { key: "codigo", label: "Code clarity" },
  { key: "defesa", label: "Defended the choice" },
] as const;

export function average(scores: Record<string, number>) {
  const values = Object.values(scores).filter((v) => v > 0);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function divergence(evaluations: { evaluator: string; scores: Record<string, number> }[]) {
  if (evaluations.length < 2) return null;
  for (const c of criteria) {
    const values = evaluations.map((e) => e.scores[c.key] ?? 0).filter(Boolean);
    if (values.length >= 2 && Math.max(...values) - Math.min(...values) >= 2) return { criterion: c.label, values: evaluations.map((e) => ({ evaluator: e.evaluator, value: e.scores[c.key] ?? 0 })) };
  }
  return null;
}

type Ev = { kind: string; createdAt: Date };
type Call = { createdAt: Date };

export function minuteStrip(start: Date | null, end: Date | null, events: Ev[], calls: Call[]) {
  if (!start) return [];
  const finish = end ?? new Date();
  const minutes = Math.max(1, Math.ceil((finish.getTime() - start.getTime()) / 60_000));
  const strip: ("lendo" | "escrevendo" | "claude" | "colou" | "entregou")[] = Array.from({ length: Math.min(minutes, 240) }, () => "lendo");
  const at = (d: Date) => Math.min(strip.length - 1, Math.max(0, Math.floor((d.getTime() - start.getTime()) / 60_000)));
  const rank = { lendo: 0, escrevendo: 1, claude: 2, colou: 3, entregou: 4 } as const;
  const put = (i: number, v: (typeof strip)[number]) => {
    if (rank[v] > rank[strip[i]]) strip[i] = v;
  };
  for (const e of events) {
    if (e.kind === "file-save") put(at(e.createdAt), "escrevendo");
    if (e.kind === "paste" || e.kind === "apply-ai") put(at(e.createdAt), "colou");
    if (e.kind === "submit") put(at(e.createdAt), "entregou");
  }
  for (const c of calls) put(at(c.createdAt), "claude");
  return strip;
}
