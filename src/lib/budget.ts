import type { Usage } from "@/lib/pricing";

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

export type Limits = { maxOutputTokens: number; maxEffort: Effort; maxThinkingTokens: number };

export type MessagesBody = {
  model?: string;
  max_tokens?: number;
  thinking?: { type?: string; budget_tokens?: number } & Record<string, unknown>;
  output_config?: { effort?: unknown } & Record<string, unknown>;
  service_tier?: unknown;
  speed?: unknown;
  stream?: boolean;
  messages?: { role: string; content: unknown }[];
} & Record<string, unknown>;

export const MIN_OUTPUT_TOKENS = 1024;
const MIN_THINKING_TOKENS = 1024;
const PREMIUM_BETAS = /context-1m|fast-mode/i;

export function parseEffort(value: string | undefined, fallback: Effort): Effort {
  return EFFORTS.includes(value as Effort) ? (value as Effort) : fallback;
}

export function clampEffort(requested: unknown, ceiling: Effort) {
  const rank = EFFORTS.indexOf(requested as Effort);
  if (rank < 0) return ceiling;
  return rank > EFFORTS.indexOf(ceiling) ? ceiling : (requested as Effort);
}

export function clampBody(body: MessagesBody, limits: Limits, outputAllowance = Infinity): MessagesBody {
  const next: MessagesBody = { ...body };
  delete next.service_tier;
  delete next.speed;
  const requested = Number.isFinite(next.max_tokens) && (next.max_tokens as number) > 0 ? Math.floor(next.max_tokens as number) : limits.maxOutputTokens;
  next.max_tokens = Math.max(1, Math.min(requested, limits.maxOutputTokens, Math.floor(outputAllowance)));
  if (next.output_config && typeof next.output_config === "object" && "effort" in next.output_config) {
    next.output_config = { ...next.output_config, effort: clampEffort(next.output_config.effort, limits.maxEffort) };
  }
  if (next.thinking && typeof next.thinking === "object" && typeof next.thinking.budget_tokens === "number") {
    const room = Math.min(limits.maxThinkingTokens, next.max_tokens - 1);
    if (room < MIN_THINKING_TOKENS) delete next.thinking;
    else next.thinking = { ...next.thinking, budget_tokens: Math.max(MIN_THINKING_TOKENS, Math.min(Math.floor(next.thinking.budget_tokens), room)) };
  }
  return next;
}

export function filterBetas(header: string | null) {
  if (!header) return null;
  const kept = header
    .split(",")
    .map((b) => b.trim())
    .filter((b) => b && !PREMIUM_BETAS.test(b));
  return kept.length ? kept.join(",") : null;
}

const IMAGE_TOKENS = 1_600;

// Base64 media is billed by what it shows, not by its size: a 1 MB screenshot is ~1.6k tokens, not 330k.
export function estimateInputTokens(body: unknown) {
  let media = 0;
  const text = JSON.stringify(body, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value) && value.type === "base64" && typeof value.data === "string") {
      media += String(value.media_type ?? "").startsWith("image/") ? IMAGE_TOKENS : Math.ceil((value.data.length * 0.75) / 3);
      return { ...value, data: "" };
    }
    return value;
  });
  return Math.ceil(Buffer.byteLength(text ?? "", "utf8") / 3) + media;
}

export function estimateOutputTokens(streamedChars: number) {
  return Math.ceil(streamedChars / 3);
}

export function billedUsage(reported: Usage, complete: boolean, streamedChars: number, estimatedInput: number): Usage {
  const usage = { ...reported };
  const sawStart = usage.input_tokens !== undefined || usage.cache_read_input_tokens !== undefined || usage.cache_creation_input_tokens !== undefined;
  if (!sawStart) usage.input_tokens = estimatedInput;
  if (!complete) usage.output_tokens = Math.max(usage.output_tokens ?? 0, estimateOutputTokens(streamedChars));
  return usage;
}

export type Price = { input: number; output: number };

// Claude Code caches its prompt, so the part already sent in the last few minutes is billed at the cache-read rate.
export function inputCost(price: Price, inputTokens: number, cachedTokens = 0) {
  const cached = Math.min(inputTokens, cachedTokens);
  return ((cached * 0.1 + (inputTokens - cached) * 1.25) * price.input) / 1_000_000;
}

export function outputCost(price: Price, outputTokens: number) {
  return (outputTokens * price.output) / 1_000_000;
}

export function outputAllowance(input: { budgetUsd: number; spentUsd: number; reservedUsd: number; inputUsd: number; price: Price }) {
  const left = input.budgetUsd - input.spentUsd - input.reservedUsd - input.inputUsd;
  if (left <= 0) return 0;
  return Math.floor((left * 1_000_000) / input.price.output);
}

type Hold = { id: number; passId: string; usd: number; at: number };
type Prompt = { tokens: number; at: number };

const CACHE_TTL_MS = 5 * 60_000;

export class Ledger {
  private holds = new Map<number, Hold>();
  private seq = 0;
  private locks = new Map<string, Promise<unknown>>();
  private prompts = new Map<string, Prompt[]>();

  constructor(private readonly staleMs = 30 * 60_000) {}

  async lock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    const run = previous.then(fn, fn);
    const tail = run.catch(() => {});
    this.locks.set(key, tail);
    try {
      return await run;
    } finally {
      if (this.locks.get(key) === tail) this.locks.delete(key);
    }
  }

  private sweep(now: number) {
    for (const [id, hold] of this.holds) if (now - hold.at > this.staleMs) this.holds.delete(id);
  }

  inflight(passId: string) {
    let n = 0;
    for (const hold of this.holds.values()) if (hold.passId === passId) n++;
    return n;
  }

  reserved(passId?: string) {
    let usd = 0;
    for (const hold of this.holds.values()) if (passId === undefined || hold.passId === passId) usd += hold.usd;
    return usd;
  }

  hold(passId: string, usd: number, now = Date.now()) {
    this.sweep(now);
    const id = ++this.seq;
    this.holds.set(id, { id, passId, usd, at: now });
    return id;
  }

  release(id: number) {
    this.holds.delete(id);
  }

  notePrompt(passId: string, tokens: number, now = Date.now()) {
    if (!(tokens > 0)) return;
    const fresh = (this.prompts.get(passId) ?? []).filter((p) => now - p.at < CACHE_TTL_MS);
    this.prompts.set(passId, [...fresh.slice(-19), { tokens, at: now }]);
  }

  cachedPrompt(passId: string, now = Date.now()) {
    let max = 0;
    for (const p of this.prompts.get(passId) ?? []) if (now - p.at < CACHE_TTL_MS && p.tokens > max) max = p.tokens;
    return max;
  }
}
