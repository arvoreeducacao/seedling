import { describe, expect, it } from "vitest";
import { agentStatus, parallelism } from "./parallel";

const T0 = Date.UTC(2026, 9, 9, 12, 0, 0);
const iso = (sec: number) => new Date(T0 + sec * 1000).toISOString();

describe("agentStatus", () => {
  it("tells working, waiting, idle and closed apart", () => {
    const now = T0 + 600_000;
    expect(agentStatus({ closed: true, now, lastCallAt: now, lastOutputAt: now })).toBe("closed");
    expect(agentStatus({ closed: false, now, lastCallAt: now - 5_000, lastOutputAt: null })).toBe("working");
    expect(agentStatus({ closed: false, now, lastCallAt: now - 60_000, lastOutputAt: now - 1_000 })).toBe("working");
    expect(agentStatus({ closed: false, now, lastCallAt: now - 60_000, lastOutputAt: now - 30_000 })).toBe("waiting");
    expect(agentStatus({ closed: false, now, lastCallAt: null, lastOutputAt: now - 1_000 })).toBe("idle");
  });
});

describe("parallelism", () => {
  it("builds working spans, waiting time, per-minute counts and overlap", () => {
    const result = parallelism({
      start: T0,
      end: T0 + 180_000,
      agents: [
        { key: "main", name: "Main", openedAt: T0, closedAt: null },
        { key: "agent-2", name: "Tests", openedAt: T0 + 30_000, closedAt: T0 + 150_000 },
      ],
      turns: [
        { agent: "main", at: iso(10), endAt: iso(70), cost: 0.1 },
        { agent: "main", at: iso(130), endAt: iso(160), cost: 0.05 },
        { agent: "agent-2", at: iso(40), endAt: iso(100), cost: 0.2 },
      ],
    });
    const [main, tests] = result.lanes;
    expect(main.spans).toEqual([{ start: T0 + 5_000, end: T0 + 70_000 }, { start: T0 + 125_000, end: T0 + 160_000 }]);
    expect(main.waitingMs).toBe(55_000 + 20_000);
    expect(tests.spans).toEqual([{ start: T0 + 35_000, end: T0 + 100_000 }]);
    expect(tests.waitingMs).toBe(50_000);
    expect(result.minutes).toEqual([2, 2, 1]);
    expect(result.peak).toBe(2);
    expect(result.overlapMs).toBe(35_000);
    expect(main.prompts).toBe(2);
    expect(tests.cost).toBeCloseTo(0.2);
  });
});
