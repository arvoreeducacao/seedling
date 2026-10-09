import { describe, expect, it } from "vitest";
import { countChanges, diffLines, toHunks } from "./diff";

describe("diffLines", () => {
  it("returns only context for identical text", () => {
    const lines = diffLines("a\nb\n", "a\nb\n");
    expect(lines.every((l) => l.kind === "context")).toBe(true);
    expect(countChanges(lines)).toEqual({ added: 0, removed: 0 });
  });

  it("marks a replaced line as one removal and one addition with line numbers", () => {
    const lines = diffLines("a\nb\nc\n", "a\nB\nc\n");
    expect(lines.map((l) => `${l.kind}:${l.text}`)).toEqual(["context:a", "del:b", "add:B", "context:c"]);
    expect(lines[1]).toMatchObject({ oldNo: 2, newNo: null });
    expect(lines[2]).toMatchObject({ oldNo: null, newNo: 2 });
    expect(lines[3]).toMatchObject({ oldNo: 3, newNo: 3 });
  });

  it("treats a new file as all additions", () => {
    expect(countChanges(diffLines("", "x\ny\n"))).toEqual({ added: 2, removed: 0 });
  });

  it("keeps line numbers aligned after an insertion", () => {
    const lines = diffLines("a\nz\n", "a\nb\nc\nz\n");
    expect(lines.at(-1)).toMatchObject({ kind: "context", text: "z", oldNo: 2, newNo: 4 });
  });
});

describe("toHunks", () => {
  it("splits distant changes into separate hunks with context", () => {
    const before = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n");
    const after = before.replace("line 2", "LINE 2").replace("line 25", "LINE 25");
    const hunks = toHunks(diffLines(before, after), 2);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].lines.map((l) => l.text)).toEqual(["line 0", "line 1", "line 2", "LINE 2", "line 3", "line 4"]);
  });
});
