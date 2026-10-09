import { describe, expect, it } from "vitest";
import { countLines, filterTree, formatBytes, kindOf, languageOf, linkKind, parseDelimited, resolveRelative } from "./file-kinds";

describe("file kinds", () => {
  it("picks a viewer by extension", () => {
    expect(kindOf("README.md")).toBe("markdown");
    expect(kindOf("data/movements.csv")).toBe("csv");
    expect(kindOf("a.TSV")).toBe("tsv");
    expect(kindOf("package.json")).toBe("json");
    expect(kindOf("logo.svg")).toBe("svg");
    expect(kindOf("shot.JPG")).toBe("image");
    expect(kindOf("spec.pdf")).toBe("pdf");
    expect(kindOf("public/index.html")).toBe("html");
    expect(kindOf("src/app.tsx")).toBe("code");
  });

  it("highlights by extension and by well-known names", () => {
    expect(languageOf("src/app.tsx")).toBe("typescript");
    expect(languageOf("main.py")).toBe("python");
    expect(languageOf("Dockerfile")).toBe("dockerfile");
    expect(languageOf(".env.local")).toBe("ini");
    expect(languageOf("styles.scss")).toBe("scss");
    expect(languageOf("LICENSE")).toBe("plaintext");
  });

  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("counts lines with and without a trailing newline", () => {
    expect(countLines("a\nb\n")).toBe(2);
    expect(countLines("a\nb")).toBe(2);
    expect(countLines("")).toBe(0);
  });
});

describe("parseDelimited", () => {
  it("handles quotes, escaped quotes, newlines inside quotes and CRLF", () => {
    const { rows } = parseDelimited('id,title,note\r\n1,"Dom Casmurro, 2nd","said ""hi""\nthen left"\r\n2,Iracema,\n', ",");
    expect(rows).toEqual([
      ["id", "title", "note"],
      ["1", "Dom Casmurro, 2nd", 'said "hi"\nthen left'],
      ["2", "Iracema", ""],
    ]);
  });

  it("splits tabs and stops at the row limit", () => {
    const { rows, truncated } = parseDelimited("a\tb\n1\t2\n3\t4\n", "\t", 2);
    expect(rows).toEqual([["a", "b"], ["1", "2"]]);
    expect(truncated).toBe(true);
  });

  it("drops a byte order mark", () => {
    expect(parseDelimited("﻿a,b", ",").rows).toEqual([["a", "b"]]);
  });
});

describe("filterTree", () => {
  const entries = [
    { path: "src", dir: true },
    { path: "src/inventory.js", dir: false },
    { path: "src/util", dir: true },
    { path: "src/util/money.js", dir: false },
    { path: "tests", dir: true },
    { path: "tests/inventory.test.js", dir: false },
  ];

  it("keeps matches and their folders", () => {
    expect(filterTree(entries, "money").map((e) => e.path)).toEqual(["src", "src/util", "src/util/money.js"]);
    expect(filterTree(entries, "INVENTORY").map((e) => e.path)).toEqual(["src", "src/inventory.js", "tests", "tests/inventory.test.js"]);
    expect(filterTree(entries, " ")).toBe(entries);
  });
});

describe("markdown links", () => {
  it("resolves relative paths against the document folder", () => {
    expect(resolveRelative("docs/guide/README.md", "../img/a b.png")).toBe("docs/img/a b.png");
    expect(resolveRelative("docs/README.md", "./setup.md#install")).toBe("docs/setup.md");
    expect(resolveRelative("README.md", "/src/index.js")).toBe("src/index.js");
    expect(resolveRelative("README.md", "../../etc/passwd")).toBeNull();
    expect(resolveRelative("README.md", "%2e%2e/x")).toBeNull();
  });

  it("classifies links so only safe ones become links", () => {
    expect(linkKind("https://example.com")).toBe("external");
    expect(linkKind("mailto:a@b.c")).toBe("external");
    expect(linkKind("#usage")).toBe("anchor");
    expect(linkKind("javascript:alert(1)")).toBe("unsafe");
    expect(linkKind(" JaVaScRiPt:alert(1)")).toBe("unsafe");
    expect(linkKind("data:text/html,x")).toBe("unsafe");
    expect(linkKind("//evil.com/x")).toBe("unsafe");
    expect(linkKind("docs/setup.md")).toBe("workspace");
  });
});
