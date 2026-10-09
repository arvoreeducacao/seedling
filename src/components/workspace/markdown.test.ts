import { describe, expect, it } from "vitest";
import { parseBlocks } from "./markdown-parse";

describe("parseBlocks", () => {
  it("splits paragraphs, lists and fenced code", () => {
    const blocks = parseBlocks("Three things:\n\n1. casing of `saida`\n2. trailing spaces\n\n```js\nconst x = 1;\n```\nDone.");
    expect(blocks.map((b) => b.kind)).toEqual(["para", "list", "code", "para"]);
    expect(blocks[1]).toMatchObject({ kind: "list", ordered: true, items: ["casing of `saida`", "trailing spaces"] });
    expect(blocks[2]).toMatchObject({ kind: "code", lang: "js", text: "const x = 1;" });
  });

  it("keeps an unclosed fence as code instead of dropping text", () => {
    const blocks = parseBlocks("```\nhalf written");
    expect(blocks).toEqual([{ kind: "code", lang: "", text: "half written" }]);
  });

  it("reads headings and quotes", () => {
    expect(parseBlocks("## Plan\n> careful").map((b) => b.kind)).toEqual(["heading", "quote"]);
  });

  it("reads tables with alignment and escaped pipes", () => {
    const [table] = parseBlocks("| Title | Qty |\n|:--|--:|\n| A \\| B | 2 |\n| C | 3 |");
    expect(table).toEqual({ kind: "table", align: ["left", "right"], header: ["Title", "Qty"], rows: [["A | B", "2"], ["C", "3"]] });
  });

  it("reads horizontal rules before lists", () => {
    expect(parseBlocks("one\n\n***\n\n- a").map((b) => b.kind)).toEqual(["para", "hr", "list"]);
  });
});
