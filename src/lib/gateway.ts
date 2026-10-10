import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db, ready, schema } from "@/lib/db";
import { hashToken, newId, newToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { costOf, priceOf, type Usage } from "@/lib/pricing";
import { Ledger, MIN_OUTPUT_TOKENS, clampBody, estimateInputTokens, billedUsage, filterBetas, outputAllowance, reservation, type MessagesBody } from "@/lib/budget";
import { AGENT_HEADER, MAIN_AGENT, validAgentKey } from "@/lib/agent-keys";
import { defaultLocale, i18nFor, type Key, type Locale, type Params, type T } from "@/lib/i18n";

export type PassCheck =
  | { ok: true; pass: typeof schema.passes.$inferSelect; session: typeof schema.sessions.$inferSelect }
  | { ok: false; status: number; reason: Key; params?: Params; locale?: Locale };

export async function issuePass(sessionId: string, expiresAt: Date, budgetUsd: number) {
  const token = newToken("sdl");
  await db.insert(schema.passes).values({ id: newId(), sessionId, tokenHash: hashToken(token), expiresAt, budgetUsd });
  return token;
}

export async function revokePasses(sessionId: string, reason: Key) {
  await db
    .update(schema.passes)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(schema.passes.sessionId, sessionId), isNull(schema.passes.revokedAt)));
}

export async function extendPasses(sessionId: string, expiresAt: Date) {
  await db
    .update(schema.passes)
    .set({ expiresAt })
    .where(and(eq(schema.passes.sessionId, sessionId), isNull(schema.passes.revokedAt)));
}

export async function monthSpend() {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.aiCalls.costUsd}), 0)` })
    .from(schema.aiCalls)
    .where(gte(schema.aiCalls.createdAt, start));
  return Number(row?.total ?? 0);
}

const globalForLedger = globalThis as unknown as { seedlingLedger?: Ledger };
export const ledger = (globalForLedger.seedlingLedger ??= new Ledger());

export async function checkPass(token: string | null): Promise<PassCheck> {
  await ready();
  if (!token) return { ok: false, status: 401, reason: "pass.missing" };
  const pass = await db.query.passes.findFirst({ where: eq(schema.passes.tokenHash, hashToken(token)) });
  if (!pass) return { ok: false, status: 401, reason: "pass.unknown" };
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, pass.sessionId) });
  const locale = session?.locale;
  if (pass.revokedAt) return { ok: false, status: 403, reason: "pass.turnedOff", locale };
  if (pass.expiresAt.getTime() <= Date.now()) return { ok: false, status: 403, reason: "pass.timeOver", locale };
  if (pass.spentUsd >= pass.budgetUsd) return { ok: false, status: 429, reason: "pass.capReached", locale };
  if (!session || session.status !== "running") return { ok: false, status: 403, reason: "server.sessionNotInProgress", locale };
  if ((await monthSpend()) + ledger.reserved() >= env.monthlyBudgetUsd) return { ok: false, status: 429, reason: "pass.monthlyCap", locale };
  return { ok: true, pass, session };
}

export function tokenFromHeaders(h: Headers) {
  const bearer = h.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer ?? h.get("x-api-key");
}

type Body = MessagesBody;

function lastUserText(body: Body) {
  const last = [...(body.messages ?? [])].reverse().find((m) => m.role === "user");
  if (!last) return null;
  if (typeof last.content === "string") return last.content;
  if (Array.isArray(last.content)) {
    const texts = last.content
      .filter((b): b is { type: string; text: string } => typeof b === "object" && b !== null && (b as { type?: string }).type === "text")
      .map((b) => b.text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim())
      .filter(Boolean);
    if (texts.length) return texts.join("\n");
    const toolResults = last.content.filter((b) => (b as { type?: string })?.type === "tool_result").length;
    return toolResults ? `[${toolResults} tool result(s)]` : null;
  }
  return null;
}

type Collected = { text: string; tools: string[]; usage: Usage; model: string };

function collectFromMessage(msg: { content?: { type: string; text?: string; name?: string }[]; usage?: Usage; model?: string }): Collected {
  const blocks = msg.content ?? [];
  return {
    text: blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join(""),
    tools: blocks.filter((b) => b.type === "tool_use").map((b) => b.name ?? "ferramenta"),
    usage: msg.usage ?? {},
    model: msg.model ?? "",
  };
}

async function record(
  pass: typeof schema.passes.$inferSelect,
  source: "panel" | "terminal",
  body: Body,
  status: number,
  collected: Collected,
  agentKey: string,
) {
  const model = collected.model || body.model || "desconhecido";
  const cost = costOf(model, collected.usage);
  await db.insert(schema.aiCalls).values({
    id: newId(),
    sessionId: pass.sessionId,
    source,
    model,
    prompt: lastUserText(body),
    response: collected.text.slice(0, 20_000),
    toolUses: collected.tools,
    inputTokens: (collected.usage.input_tokens ?? 0) + (collected.usage.cache_read_input_tokens ?? 0) + (collected.usage.cache_creation_input_tokens ?? 0),
    outputTokens: collected.usage.output_tokens ?? 0,
    costUsd: cost,
    status,
    agentKey,
  });
  if (cost > 0) {
    await db
      .update(schema.passes)
      .set({ spentUsd: sql`${schema.passes.spentUsd} + ${cost}` })
      .where(eq(schema.passes.id, pass.id));
  }
}

function meterStream(upstream: ReadableStream<Uint8Array>, abort: AbortController, onDone: (c: Collected, complete: boolean, streamedChars: number) => Promise<void>) {
  const decoder = new TextDecoder();
  const reader = upstream.getReader();
  let buffer = "";
  let streamedChars = 0;
  let complete = false;
  let settled = false;
  const collected: Collected = { text: "", tools: [], usage: {}, model: "" };
  const settle = () => {
    if (settled) return;
    settled = true;
    void onDone(collected, complete, streamedChars).catch((error) => console.error("[seedling] gateway record", error));
  };
  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    try {
      const evt = JSON.parse(line.slice(5).trim());
      if (evt.type === "message_start") {
        collected.model = evt.message?.model ?? "";
        collected.usage = { ...evt.message?.usage };
      } else if (evt.type === "content_block_start" && evt.content_block?.type === "tool_use") {
        collected.tools.push(evt.content_block.name);
      } else if (evt.type === "content_block_delta") {
        const delta = evt.delta ?? {};
        const piece = String(delta.text ?? delta.partial_json ?? delta.thinking ?? "");
        streamedChars += piece.length;
        if (delta.type === "text_delta") collected.text += piece;
      } else if (evt.type === "message_delta" && evt.usage) {
        collected.usage = { ...collected.usage, ...evt.usage };
      } else if (evt.type === "message_stop") {
        complete = true;
      }
    } catch {}
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer) handle(buffer);
          buffer = "";
          settle();
          controller.close();
          return;
        }
        controller.enqueue(value);
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
      } catch (error) {
        settle();
        controller.error(error);
      }
    },
    async cancel() {
      abort.abort();
      settle();
      await reader.cancel().catch(() => {});
    },
  });
}

const forwardHeaders = ["anthropic-version", "anthropic-beta", "content-type"];

function upstreamModel(model: string) {
  if (!env.anthropicModelPrefix) return model;
  return `${env.anthropicModelPrefix}${model.replace(/-(\d+)-(\d+)$/, "-$1.$2")}`;
}

export async function forwardMessages(req: Request, source: "panel" | "terminal", readerLocale?: Locale) {
  const check = await checkPass(tokenFromHeaders(req.headers));
  if (!check.ok) return errorResponse(check.status, localeOf(readerLocale, check.locale), check.reason, check.params);
  const { t } = i18nFor(localeOf(readerLocale, check.session.locale));
  if (!env.anthropicKey) return errorResponse(503, t, "pass.noServerKey");
  const raw = await req.text();
  let parsed: Body;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return errorResponse(400, t, "error.badBody");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return errorResponse(400, t, "error.badBody");
  const model = upstreamModel(check.session.model);
  const price = priceOf(model);
  const inputTokens = estimateInputTokens(raw);
  const limits = env.ai;
  const admitted = await ledger.lock(check.pass.id, async () => {
    const pass = await db.query.passes.findFirst({ where: eq(schema.passes.id, check.pass.id) });
    if (!pass || pass.revokedAt) return { ok: false as const, error: errorResponse(403, t, "pass.turnedOff") };
    if (ledger.inflight(pass.id) >= limits.maxInflight) return { ok: false as const, error: errorResponse(429, t, "pass.tooManyParallel", { max: limits.maxInflight }) };
    const allowance = outputAllowance({ budgetUsd: pass.budgetUsd, spentUsd: pass.spentUsd, reservedUsd: ledger.reserved(pass.id), inputTokens, price });
    const requested = Number.isFinite(parsed.max_tokens) && (parsed.max_tokens as number) > 0 ? (parsed.max_tokens as number) : limits.maxOutputTokens;
    if (allowance < Math.min(requested, MIN_OUTPUT_TOKENS)) return { ok: false as const, error: errorResponse(429, t, "pass.capReached") };
    const body = { ...clampBody(parsed, limits, allowance), model };
    const hold = ledger.hold(pass.id, reservation(price, inputTokens, body.max_tokens ?? 0));
    return { ok: true as const, body, hold };
  });
  if (!admitted.ok) return admitted.error;
  const { body, hold } = admitted;
  const claimed = req.headers.get(AGENT_HEADER)?.trim();
  const agentKey = validAgentKey(claimed) ? claimed : MAIN_AGENT;
  const headers = new Headers({ "x-api-key": env.anthropicKey });
  for (const name of forwardHeaders) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const betas = filterBetas(headers.get("anthropic-beta"));
  if (betas) headers.set("anthropic-beta", betas);
  else headers.delete("anthropic-beta");
  if (!headers.has("anthropic-version")) headers.set("anthropic-version", "2023-06-01");
  headers.set("content-type", "application/json");
  const settle = (status: number, collected: Collected) =>
    ledger.lock(check.pass.id, () => record(check.pass, source, body, status, collected, agentKey)).finally(() => ledger.release(hold));
  const abort = new AbortController();
  let upstream: Response;
  try {
    upstream = await fetch(`${env.anthropicUpstream}/v1/messages`, { method: "POST", headers, body: JSON.stringify(body), signal: abort.signal });
  } catch {
    ledger.release(hold);
    return errorResponse(502, t, "pass.upstreamDown");
  }
  const outHeaders = new Headers({ "content-type": upstream.headers.get("content-type") ?? "application/json" });
  if (body.stream && upstream.ok && upstream.body) {
    const stream = meterStream(upstream.body, abort, (c, complete, chars) => settle(complete ? upstream.status : 499, { ...c, usage: billedUsage(c.usage, complete, chars, inputTokens) }));
    return new Response(stream, { status: upstream.status, headers: outHeaders });
  }
  const text = await upstream.text().catch(() => "");
  let collected: Collected = { text: "", tools: [], usage: {}, model: body.model ?? "" };
  try {
    collected = collectFromMessage(JSON.parse(text));
  } catch {}
  await settle(upstream.status, upstream.ok ? collected : { ...collected, text: text.slice(0, 2000) });
  return new Response(text, { status: upstream.status, headers: outHeaders });
}

export async function countTokens(req: Request, readerLocale?: Locale) {
  const check = await checkPass(tokenFromHeaders(req.headers));
  if (!check.ok) return errorResponse(check.status, localeOf(readerLocale, check.locale), check.reason, check.params);
  const body = await req.json().catch(() => ({}));
  body.model = upstreamModel(check.session.model);
  const upstream = await fetch(`${env.anthropicUpstream}/v1/messages/count_tokens`, {
    method: "POST",
    headers: {
      "x-api-key": env.anthropicKey,
      "anthropic-version": req.headers.get("anthropic-version") ?? "2023-06-01",
      "content-type": "application/json",
      ...(req.headers.get("anthropic-beta") ? { "anthropic-beta": req.headers.get("anthropic-beta")! } : {}),
    },
    body: JSON.stringify(body),
  });
  return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
}

function localeOf(...candidates: (Locale | undefined)[]): Locale {
  return candidates.find(Boolean) ?? defaultLocale;
}

export function errorResponse(status: number, voice: T | Locale, key: Key, params?: Params) {
  const t = typeof voice === "function" ? voice : i18nFor(voice).t;
  return Response.json(
    { type: "error", error: { type: status === 429 ? "rate_limit_error" : status === 401 ? "authentication_error" : "permission_error", message: t(key, params) } },
    { status },
  );
}
