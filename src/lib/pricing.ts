const perMillion: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export const modelOptions = [
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  { id: "claude-opus-5-5", label: "Opus 5.5" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5" },
];

export function modelLabel(id: string) {
  return modelOptions.find((m) => m.id === id)?.label ?? id;
}

export type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

export function priceOf(upstreamModel: string) {
  const model = upstreamModel.replace(/^[a-z]+\//, "").replace(/\./g, "-");
  const known = perMillion[model] ?? perMillion[Object.keys(perMillion).find((k) => model.startsWith(k)) ?? ""];
  if (known) return known;
  return Object.values(perMillion).reduce((max, p) => ({ input: Math.max(max.input, p.input), output: Math.max(max.output, p.output) }));
}

export function costOf(upstreamModel: string, usage: Usage) {
  const price = priceOf(upstreamModel);
  const input =
    (usage.input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) * 0.1 +
    (usage.cache_creation_input_tokens ?? 0) * 1.25;
  return (input * price.input + (usage.output_tokens ?? 0) * price.output) / 1_000_000;
}
