import { describe, expect, it } from "vitest";
import { defaultKit, parseKit } from "./kit";
import { PLAYGROUND_DEFAULTS, PLAYGROUND_FILES, isPlayground, practicePlan, practiceRoomFree } from "./playground";

describe("practice modes in the kit", () => {
  it("defaults new kits to the playground at $1 and 20 minutes", () => {
    expect(defaultKit.practice).toMatchObject({ mode: "playground", enabled: true, ...PLAYGROUND_DEFAULTS });
    const parsed = parseKit({ name: "Fresh" });
    expect(parsed.ok && parsed.kit.practice).toMatchObject({ mode: "playground", budgetUsd: 1, minutes: 20 });
  });

  it("keeps kits saved before modes existed working", () => {
    const off = parseKit({ practice: { enabled: false, challengeId: null, budgetUsd: 1, minutes: 15 } });
    expect(off.ok && off.kit.practice).toMatchObject({ mode: "off", enabled: false });
    const challenge = parseKit({ practice: { enabled: true, challengeId: "c1", budgetUsd: 2, minutes: 30 } }, [{ id: "c1", slug: "x", status: "published" }]);
    expect(challenge.ok && challenge.kit.practice).toMatchObject({ mode: "challenge", challengeId: "c1", budgetUsd: 2, minutes: 30 });
  });

  it("falls back to the playground when the chosen challenge isn't available", () => {
    const parsed = parseKit({ practice: { mode: "challenge", challenge: "missing" } }, []);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.kit.practice).toMatchObject({ mode: "playground", challengeId: null });
    expect(parsed.notes[0]).toContain("playground");
  });

  it("rejects limits outside the allowed range", () => {
    expect(parseKit({ practice: { mode: "playground", budgetUsd: 50 } }).ok).toBe(false);
    expect(parseKit({ practice: { mode: "playground", minutes: 2 } }).ok).toBe(false);
  });
});

describe("practicePlan", () => {
  it("is null when practice is off", () => {
    expect(practicePlan({ mode: "off", enabled: false, challengeId: null, budgetUsd: 1, minutes: 20 })).toBeNull();
  });

  it("gives the playground its own budget and time, with no challenge", () => {
    expect(practicePlan({ mode: "playground", enabled: true, challengeId: "ignored", budgetUsd: 1, minutes: 20 })).toEqual({ kind: "playground", challengeId: null, budgetUsd: 1, minutes: 20 });
  });

  it("clamps the limits so a hand-edited kit can't open an unbounded sandbox", () => {
    expect(practicePlan({ mode: "playground", enabled: true, challengeId: null, budgetUsd: 500, minutes: 9000 })).toMatchObject({ budgetUsd: 20, minutes: 120 });
    expect(practicePlan({ mode: "playground", enabled: true, challengeId: null, budgetUsd: 0, minutes: 1 })).toMatchObject({ budgetUsd: 0.1, minutes: 5 });
  });

  it("needs a challenge in challenge mode", () => {
    expect(practicePlan({ mode: "challenge", enabled: true, challengeId: null, budgetUsd: 1, minutes: 15 })).toBeNull();
    expect(practicePlan({ mode: "challenge", enabled: true, challengeId: "c1", budgetUsd: 1, minutes: 15 })).toMatchObject({ kind: "challenge", challengeId: "c1" });
  });
});

describe("practiceRoomFree", () => {
  it("keeps one room free for real interviews when there is more than one", () => {
    expect(practiceRoomFree(0, 2)).toBe(true);
    expect(practiceRoomFree(1, 2)).toBe(false);
    expect(practiceRoomFree(2, 4)).toBe(true);
    expect(practiceRoomFree(3, 4)).toBe(false);
  });

  it("uses the only room when the limit is one", () => {
    expect(practiceRoomFree(0, 1)).toBe(true);
    expect(practiceRoomFree(1, 1)).toBe(false);
  });
});

describe("the playground workspace", () => {
  it("is only a practice session without challenges", () => {
    expect(isPlayground({ practiceOf: "parent", challengeIds: [] })).toBe(true);
    expect(isPlayground({ practiceOf: "parent", challengeIds: ["c1"] })).toBe(false);
    expect(isPlayground({ practiceOf: null, challengeIds: [] })).toBe(false);
  });

  it("ships a README that says it isn't graded and a small project with tests", () => {
    expect(PLAYGROUND_FILES["README.md"]).toMatch(/nothing here is graded/i);
    expect(Object.keys(PLAYGROUND_FILES)).toEqual(expect.arrayContaining(["package.json", "src/cart.js", "test/cart.test.js"]));
    expect(Object.keys(PLAYGROUND_FILES).every((p) => !p.startsWith("/") && !p.includes(".."))).toBe(true);
  });
});
