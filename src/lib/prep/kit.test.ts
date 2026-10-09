import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultKit, exportKit, parseKit, prepOpensAt } from "./kit";

const challenges = [
  { id: "c1", slug: "book-inventory", status: "published" },
  { id: "c2", slug: "draft-one", status: "draft" },
];

describe("parseKit", () => {
  it("accepts the default kit", () => {
    const parsed = parseKit(defaultKit);
    expect(parsed.ok).toBe(true);
  });

  it("imports the example kit", () => {
    const file = JSON.parse(fs.readFileSync(path.resolve("examples/prep/arvore.json"), "utf8"));
    const parsed = parseKit(file, challenges);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.kit.sections.length).toBeGreaterThan(3);
    expect(parsed.kit.sections.flatMap((s) => s.links).every((l) => l.why.length > 0)).toBe(true);
    expect(new Set(parsed.kit.sections.map((s) => s.id)).size).toBe(parsed.kit.sections.length);
  });

  it("resolves the practice challenge by slug and only when published", () => {
    const on = parseKit({ practice: { enabled: true, challenge: "book-inventory" } }, challenges);
    expect(on.ok && on.kit.practice).toMatchObject({ enabled: true, challengeId: "c1" });
    const draft = parseKit({ practice: { enabled: true, challenge: "draft-one" } }, challenges);
    expect(draft.ok && draft.kit.practice).toMatchObject({ mode: "playground", challengeId: null });
    expect(draft.ok && draft.notes.length).toBe(1);
  });

  it("rejects links that are not http", () => {
    const parsed = parseKit({ sections: [{ title: "x", links: [{ title: "bad", url: "javascript:alert(1)" }] }] });
    expect(parsed.ok).toBe(false);
  });

  it("round-trips through export", () => {
    const parsed = parseKit({ name: "Kit", sections: [{ title: "A", body: "b", links: [{ title: "l", url: "https://x.dev" }] }], practice: { enabled: true, challengeId: "c1" } }, challenges);
    if (!parsed.ok) throw new Error(parsed.error);
    const exported = exportKit(parsed.kit, challenges);
    expect(exported.practice.challenge).toBe("book-inventory");
    expect(JSON.stringify(exported)).not.toContain('"id"');
    const again = parseKit(JSON.parse(JSON.stringify(exported)), challenges);
    expect(again.ok && again.kit.practice.challengeId).toBe("c1");
  });
});

describe("prepOpensAt", () => {
  it("counts back from the interview", () => {
    const at = new Date("2026-10-20T15:00:00Z");
    expect(prepOpensAt({ ...defaultKit, opensDaysBefore: 3 }, at)?.toISOString()).toBe("2026-10-17T15:00:00.000Z");
    expect(prepOpensAt(defaultKit, null)).toBeNull();
  });
});
