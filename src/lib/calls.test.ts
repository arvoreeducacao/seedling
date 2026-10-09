import { describe, expect, it } from "vitest";
import { classifyCall, groupTurns, type RecordedCall } from "./calls";

function call(id: string, prompt: string | null, extra: Partial<RecordedCall> = {}): RecordedCall {
  return { id, at: `2026-10-09T12:00:0${id}.000Z`, source: "terminal", prompt, response: null, tools: [], cost: 0.01, status: 200, ...extra };
}

describe("classifyCall", () => {
  it("treats tool-result-only turns as agent steps", () => {
    expect(classifyCall(call("1", "[2 tool result(s)]"))).toBe("tool");
  });

  it("hides Claude Code side calls", () => {
    expect(classifyCall(call("1", "<session>fix the csv</session> Write the title in the predominant language of the session"))).toBe("internal");
    expect(classifyCall(call("1", "Analyze if this message indicates a new conversation topic"))).toBe("internal");
    expect(classifyCall(call("1", null))).toBe("internal");
  });

  it("keeps what the candidate typed", () => {
    expect(classifyCall(call("1", "read the brief and tell me what looks wrong in the data"))).toBe("user");
  });
});

describe("groupTurns", () => {
  it("folds agent steps into the user turn they belong to", () => {
    const { turns, internal } = groupTurns([
      call("1", "fix the stock function", { tools: ["Read"] }),
      call("2", "<session>x</session> write the title", { response: "Fix stock" }),
      call("3", "[1 tool result(s)]", { tools: ["Edit", "Read"] }),
      call("4", "[1 tool result(s)]", { response: "Done, tests pass.", status: 500 }),
      call("5", "now add a NOTES.md"),
    ]);
    expect(internal.map((c) => c.id)).toEqual(["2"]);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ prompt: "fix the stock function", response: "Done, tests pass.", tools: ["Read", "Edit"], steps: 3, failed: 1 });
    expect(turns[0].cost).toBeCloseTo(0.03);
    expect(turns[1].prompt).toBe("now add a NOTES.md");
  });

  it("does not invent a turn for steps that come before any user message", () => {
    const { turns, internal } = groupTurns([call("1", "[1 tool result(s)]")]);
    expect(turns).toHaveLength(0);
    expect(internal).toHaveLength(1);
  });
});

describe("groupTurns with several agents", () => {
  it("keeps each agent's tool steps in its own turn when calls interleave", () => {
    const at = (s: number) => new Date(Date.UTC(2026, 9, 9, 12, 0, s)).toISOString();
    const call = (id: string, s: number, agent: string, prompt: string, response: string | null = null) => ({ id, at: at(s), source: "terminal", prompt, response, tools: [], cost: 0.01, status: 200, agent });
    const { turns } = groupTurns([
      call("1", 0, "main", "fix the parser"),
      call("2", 1, "agent-2", "write the tests"),
      call("3", 2, "main", "[1 tool result(s)]", "parser fixed"),
      call("4", 3, "agent-2", "[2 tool result(s)]", "tests written"),
    ]);
    expect(turns.map((t) => [t.agent, t.prompt, t.steps, t.response, t.endAt])).toEqual([
      ["main", "fix the parser", 2, "parser fixed", at(2)],
      ["agent-2", "write the tests", 2, "tests written", at(3)],
    ]);
  });
});
