import { describe, expect, it } from "vitest";
import { parseTestLines } from "./test-lines";

describe("parseTestLines", () => {
  it("reads node --test spec output", () => {
    const out = "\u001b[32m✔ sums entries (0.8ms)\u001b[39m\n✖ trims isbn (1.2ms)\nℹ tests 2\nℹ pass 1";
    expect(parseTestLines(out)).toEqual([
      { name: "sums entries", passed: true, meta: "0.8ms" },
      { name: "trims isbn", passed: false, meta: "1.2ms" },
    ]);
  });

  it("reads TAP and pytest", () => {
    expect(parseTestLines("ok 1 - adds\nnot ok 2 - removes # fail")).toEqual([
      { name: "adds", passed: true, meta: null },
      { name: "removes", passed: false, meta: null },
    ]);
    expect(parseTestLines("tests/test_stock.py::test_returns PASSED  [50%]")).toEqual([{ name: "test_returns", passed: true, meta: null }]);
  });
});
