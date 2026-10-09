import { describe, expect, it } from "vitest";
import { Ledger, billedUsage, clampBody, clampEffort, filterBetas, outputAllowance, reservation, type Limits } from "./budget";

const limits: Limits = { maxOutputTokens: 32_000, maxEffort: "high", maxThinkingTokens: 16_000 };
const price = { input: 4, output: 20 };

describe("request clamping", () => {
  it("caps max_tokens, thinking and effort and drops premium knobs", () => {
    const body = clampBody({ max_tokens: 1_000_000, thinking: { type: "enabled", budget_tokens: 500_000 }, output_config: { effort: "max" }, service_tier: "priority", speed: "fast" }, limits);
    expect(body.max_tokens).toBe(32_000);
    expect(body.thinking?.budget_tokens).toBe(16_000);
    expect(body.output_config?.effort).toBe("high");
    expect(body).not.toHaveProperty("service_tier");
    expect(body).not.toHaveProperty("speed");
  });

  it("keeps cheaper settings as they are", () => {
    const body = clampBody({ max_tokens: 4000, output_config: { effort: "low" } }, limits);
    expect(body.max_tokens).toBe(4000);
    expect(body.output_config?.effort).toBe("low");
    expect(clampEffort("garbage", "medium")).toBe("medium");
  });

  it("shrinks max_tokens to what the budget left can pay for, dropping thinking that no longer fits", () => {
    const body = clampBody({ max_tokens: 20_000, thinking: { type: "enabled", budget_tokens: 8000 } }, limits, 1000);
    expect(body.max_tokens).toBe(1000);
    expect(body.thinking).toBeUndefined();
  });

  it("removes long-context and fast-mode betas", () => {
    expect(filterBetas("context-1m-2025-08-07,interleaved-thinking-2025-05-14,fast-mode-2026-02-01")).toBe("interleaved-thinking-2025-05-14");
    expect(filterBetas("context-1m-2025-08-07")).toBeNull();
    expect(filterBetas(null)).toBeNull();
  });
});

describe("budget reservation", () => {
  it("counts in-flight reservations against what is left", () => {
    expect(outputAllowance({ budgetUsd: 1, spentUsd: 0, reservedUsd: 0, inputTokens: 0, price })).toBe(50_000);
    expect(outputAllowance({ budgetUsd: 1, spentUsd: 0.5, reservedUsd: 0.25, inputTokens: 0, price })).toBe(12_500);
    expect(outputAllowance({ budgetUsd: 1, spentUsd: 0.5, reservedUsd: 0.6, inputTokens: 0, price })).toBe(0);
    expect(outputAllowance({ budgetUsd: 1, spentUsd: 0, reservedUsd: 0, inputTokens: 250_000, price })).toBe(0);
    expect(reservation(price, 1000, 1000)).toBeCloseTo(0.024);
  });

  it("bills an aborted stream for what it consumed", () => {
    expect(billedUsage({ input_tokens: 1200, output_tokens: 1 }, false, 3000, 9999)).toEqual({ input_tokens: 1200, output_tokens: 1000 });
    expect(billedUsage({}, false, 0, 5000)).toEqual({ input_tokens: 5000, output_tokens: 0 });
    expect(billedUsage({ input_tokens: 10, output_tokens: 700 }, true, 3, 9999)).toEqual({ input_tokens: 10, output_tokens: 700 });
  });

  it("tracks holds per pass and forgets stale ones", () => {
    const ledger = new Ledger(1000);
    const a = ledger.hold("p1", 0.5, 0);
    ledger.hold("p1", 0.25, 0);
    ledger.hold("p2", 1, 0);
    expect(ledger.inflight("p1")).toBe(2);
    expect(ledger.reserved("p1")).toBeCloseTo(0.75);
    expect(ledger.reserved()).toBeCloseTo(1.75);
    ledger.release(a);
    expect(ledger.reserved("p1")).toBeCloseTo(0.25);
    ledger.hold("p3", 1, 5000);
    expect(ledger.inflight("p1")).toBe(0);
  });

  it("serializes work per pass", async () => {
    const ledger = new Ledger();
    const order: string[] = [];
    const slow = ledger.lock("p", async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push("first");
    });
    const fast = ledger.lock("p", async () => {
      order.push("second");
    });
    const other = ledger.lock("q", async () => {
      order.push("other");
    });
    await Promise.all([slow, fast, other]);
    expect(order).toEqual(["other", "first", "second"]);
  });
});
