import { describe, expect, it } from "vitest";
import { applyMark, buildSteps, completion, firstOpenStep, nextSection, parseStep, stepAfter, stepBefore } from "./steps";

const input = { sections: ["a", "b", "c"], bring: true, practice: true };
const empty = { sectionsDone: [], stepsDone: [], broughtItems: 0, practiceUsed: false };

describe("buildSteps", () => {
  it("lists the five steps in order and starts at the welcome", () => {
    const steps = buildSteps(input, empty);
    expect(steps.map((s) => s.id)).toEqual(["welcome", "read", "setup", "practice", "ready"]);
    expect(firstOpenStep(steps)).toBe("welcome");
    expect(steps.find((s) => s.id === "setup")?.optional).toBe(true);
  });

  it("drops the steps a kit doesn't offer", () => {
    const steps = buildSteps({ sections: [], bring: false, practice: false }, empty);
    expect(steps.map((s) => s.id)).toEqual(["welcome", "ready"]);
  });

  it("counts reads as partial until every section is done", () => {
    const partial = buildSteps(input, { ...empty, stepsDone: ["welcome"], sectionsDone: ["a", "zzz"] });
    expect(partial.find((s) => s.id === "read")).toMatchObject({ status: "partial", done: 1, total: 3 });
    expect(firstOpenStep(partial)).toBe("read");
    const full = buildSteps(input, { ...empty, stepsDone: ["welcome"], sectionsDone: ["a", "b", "c"] });
    expect(full.find((s) => s.id === "read")?.status).toBe("done");
    expect(firstOpenStep(full)).toBe("setup");
  });

  it("treats bringing something as finishing the setup step and a skip as settled", () => {
    expect(buildSteps(input, { ...empty, broughtItems: 2 }).find((s) => s.id === "setup")?.status).toBe("done");
    expect(buildSteps(input, { ...empty, stepsDone: ["setup~skip"] }).find((s) => s.id === "setup")?.status).toBe("skipped");
  });

  it("marks ready only when everything before it is done or skipped", () => {
    const progress = { sectionsDone: ["a", "b", "c"], stepsDone: ["welcome", "setup~skip"], broughtItems: 0, practiceUsed: true };
    const steps = buildSteps(input, progress);
    expect(steps.find((s) => s.id === "ready")?.status).toBe("done");
    expect(firstOpenStep(steps)).toBe("ready");
    expect(firstOpenStep(buildSteps(input, { ...progress, practiceUsed: false }))).toBe("practice");
  });
});

describe("completion", () => {
  it("counts each section and each step as one unit", () => {
    expect(completion(buildSteps(input, empty))).toEqual({ done: 0, total: 6, pct: 0 });
    expect(completion(buildSteps(input, { ...empty, stepsDone: ["welcome", "practice~skip"], sectionsDone: ["b"] }))).toEqual({ done: 3, total: 6, pct: 50 });
  });

  it("is complete for a kit with nothing to do but the welcome once it's seen", () => {
    expect(completion(buildSteps({ sections: [], bring: false, practice: false }, { ...empty, stepsDone: ["welcome"] })).pct).toBe(100);
  });
});

describe("navigation", () => {
  const steps = buildSteps(input, empty);

  it("moves forward and back and stops at the ends", () => {
    expect(stepAfter(steps, "welcome")).toBe("read");
    expect(stepAfter(steps, "ready")).toBe("ready");
    expect(stepBefore(steps, "setup")).toBe("read");
    expect(stepBefore(steps, "welcome")).toBeNull();
  });

  it("finds the next unread section after the current one, wrapping around", () => {
    expect(nextSection(["a", "b", "c"], [])).toBe("a");
    expect(nextSection(["a", "b", "c"], ["a", "b"], "b")).toBe("c");
    expect(nextSection(["a", "b", "c"], ["b", "c"], "c")).toBe("a");
    expect(nextSection(["a", "b", "c"], ["a", "b", "c"], "a")).toBeNull();
  });

  it("only accepts step ids the kit has", () => {
    expect(parseStep("setup", steps)).toBe("setup");
    expect(parseStep("setup", buildSteps({ ...input, bring: false }, empty))).toBeNull();
    expect(parseStep("nope", steps)).toBeNull();
    expect(parseStep(null, steps)).toBeNull();
  });
});

describe("applyMark", () => {
  it("makes done and skipped exclusive and ignores unknown marks", () => {
    expect(applyMark(["setup~skip", "junk"], "setup", true)).toEqual(["setup"]);
    expect(applyMark(["setup"], "setup~skip", true)).toEqual(["setup~skip"]);
    expect(applyMark(["welcome", "practice"], "practice", false)).toEqual(["welcome"]);
  });
});
