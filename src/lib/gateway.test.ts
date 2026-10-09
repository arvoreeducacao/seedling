import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seedling-gateway-"));
process.env.SEEDLING_DATA_DIR = dir;
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.SEEDLING_AI_MAX_INFLIGHT = "2";
process.env.SEEDLING_AI_MAX_OUTPUT_TOKENS = "8000";

const received: Record<string, unknown>[] = [];
const upstream = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw);
    received.push(body);
    if (!body.stream) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ model: body.model, content: [{ type: "text", text: "ok" }], usage: { input_tokens: 100, output_tokens: 10 } }));
      return;
    }
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ type: "message_start", message: { model: body.model, usage: { input_tokens: 20_000, output_tokens: 1 } } })}\n\n`);
    const timer = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "x".repeat(3000) } })}\n\n`);
    }, 10);
    res.on("close", () => clearInterval(timer));
  });
});

let gateway: typeof import("./gateway");
let dbm: typeof import("./db");

async function newPass(budgetUsd: number) {
  const { newId } = await import("./crypto");
  const sessionId = newId();
  await dbm.db.insert(dbm.schema.sessions).values({ id: sessionId, candidateEmail: "c@example.com", inviteTokenHash: newId(), inviteExpiresAt: new Date(Date.now() + 86_400_000), challengeIds: [], minutes: 60, budgetUsd, model: "claude-sonnet-5-5", status: "running", startedAt: new Date() });
  const token = await gateway.issuePass(sessionId, new Date(Date.now() + 3_600_000), budgetUsd);
  return { sessionId, token };
}

function call(token: string, body: Record<string, unknown>) {
  return gateway.forwardMessages(new Request("http://seedling.test/v1/messages", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], ...body }) }), "terminal");
}

async function spent(sessionId: string) {
  const { eq } = await import("drizzle-orm");
  const pass = await dbm.db.query.passes.findFirst({ where: eq(dbm.schema.passes.sessionId, sessionId) });
  const calls = await dbm.db.query.aiCalls.findMany({ where: eq(dbm.schema.aiCalls.sessionId, sessionId) });
  return { spentUsd: pass?.spentUsd ?? 0, calls };
}

beforeAll(async () => {
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  process.env.ANTHROPIC_UPSTREAM_URL = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  dbm = await import("./db");
  await dbm.ready();
  gateway = await import("./gateway");
});

afterAll(() => {
  upstream.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const settle = () => new Promise((r) => setTimeout(r, 150));

describe("gateway budget", () => {
  it("clamps candidate-controlled knobs before forwarding", async () => {
    const { token } = await newPass(5);
    const res = await call(token, { max_tokens: 999_999, output_config: { effort: "max" }, service_tier: "priority", model: "claude-fable-5-1" });
    expect(res.status).toBe(200);
    const sent = received.at(-1)!;
    expect(sent.max_tokens).toBe(8000);
    expect(sent.model).toBe("claude-sonnet-5-5");
    expect((sent.output_config as { effort: string }).effort).toBe("high");
    expect(sent).not.toHaveProperty("service_tier");
  });

  it("bills a stream the client walks away from", async () => {
    const { sessionId, token } = await newPass(5);
    const res = await call(token, { max_tokens: 4000, stream: true });
    const reader = res.body!.getReader();
    for (let i = 0; i < 5; i++) await reader.read();
    await reader.cancel();
    await settle();
    const { spentUsd, calls } = await spent(sessionId);
    expect(calls).toHaveLength(1);
    expect(calls[0].status).toBe(499);
    expect(calls[0].inputTokens).toBe(20_000);
    expect(calls[0].outputTokens).toBeGreaterThan(0);
    expect(spentUsd).toBeGreaterThan(0.04);
  });

  it("caps parallel requests per pass and frees the slot when one ends", async () => {
    const { token } = await newPass(5);
    const first = await call(token, { max_tokens: 1000, stream: true });
    const second = await call(token, { max_tokens: 1000, stream: true });
    const third = await call(token, { max_tokens: 1000, stream: true });
    expect(third.status).toBe(429);
    await first.body!.cancel();
    await settle();
    const fourth = await call(token, { max_tokens: 1000, stream: true });
    expect(fourth.status).toBe(200);
    await second.body!.cancel();
    await fourth.body!.cancel();
    await settle();
  });

  it("refuses a request the budget left cannot cover once in-flight work is counted", async () => {
    const { token } = await newPass(0.05);
    const first = await call(token, { max_tokens: 4000, stream: true });
    expect(first.status).toBe(200);
    const second = await call(token, { max_tokens: 4000, stream: true });
    expect(second.status).toBe(429);
    await first.body!.cancel();
    await settle();
  });
});
