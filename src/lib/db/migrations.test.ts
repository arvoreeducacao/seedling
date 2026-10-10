import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const folder = path.resolve("drizzle");
const journal = JSON.parse(fs.readFileSync(path.join(folder, "meta", "_journal.json"), "utf8")) as {
  entries: { idx: number; when: number; tag: string }[];
};

describe("the migration journal", () => {
  it("grows in time, so the runner never skips a migration", () => {
    const whens = journal.entries.map((entry) => entry.when);
    expect(whens).toEqual([...whens].sort((a, b) => a - b));
    expect(new Set(whens).size).toBe(whens.length);
  });

  it("numbers the entries in order", () => {
    expect(journal.entries.map((entry) => entry.idx)).toEqual(journal.entries.map((_, index) => index));
  });

  it("has one entry for every sql file", () => {
    const files = fs.readdirSync(folder).filter((name) => name.endsWith(".sql")).map((name) => name.replace(/\.sql$/, "")).sort();
    expect(journal.entries.map((entry) => entry.tag).sort()).toEqual(files);
  });
});
