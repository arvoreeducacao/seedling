import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dictionaries, i18nFor, interpolate, locales, pickLocale, translator } from ".";
import { en } from "./en";
import { pt } from "./pt";
import { money, relativeDays, when } from "@/lib/format";

type Key = keyof typeof en;

function sourceOf(dir = path.resolve("src")): string {
  let out = "";
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out += sourceOf(full);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !/i18n\/(en|pt)\//.test(full)) out += fs.readFileSync(full, "utf8");
  }
  return out;
}

describe("pickLocale", () => {
  it("falls back to english with no header", () => {
    expect(pickLocale(null)).toBe("en");
    expect(pickLocale("")).toBe("en");
    expect(pickLocale("*")).toBe("en");
  });

  it("reads a plain tag", () => {
    expect(pickLocale("pt")).toBe("pt");
    expect(pickLocale("pt-BR")).toBe("pt");
    expect(pickLocale("EN-us")).toBe("en");
  });

  it("honours the quality order, not the written order", () => {
    expect(pickLocale("fr;q=0.9,pt-BR;q=0.8,en;q=0.2")).toBe("pt");
    expect(pickLocale("pt;q=0.3,en-GB;q=0.9")).toBe("en");
  });

  it("skips a language we do not have", () => {
    expect(pickLocale("de-DE,fr;q=0.8")).toBe("en");
  });

  it("ignores a zero or broken quality", () => {
    expect(pickLocale("pt;q=0,de")).toBe("en");
    expect(pickLocale("pt;q=abc")).toBe("en");
  });
});

describe("the two dictionaries", () => {
  it("have the same keys", () => {
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
  });

  it("have no empty value", () => {
    for (const locale of locales) {
      for (const [key, value] of Object.entries(dictionaries[locale])) {
        expect(value.trim(), `${locale}:${key}`).not.toBe("");
      }
    }
  });

  it("use the same placeholders on both sides", () => {
    const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en) as Key[]) {
      expect(names(pt[key]), key).toEqual(names(en[key]));
    }
  });

  it("have the plural forms on both sides", () => {
    for (const key of Object.keys(en) as Key[]) {
      expect(pt[key].split("|").length, key).toBe(en[key].split("|").length);
    }
  });

  it("give a plural form to every value that counts something", () => {
    const counting = (Object.keys(en) as Key[]).filter((key) => /\{n\}/.test(en[key]) && !en[key].includes("|"));
    expect(counting).toEqual([]);
  });

  it("have no key that nothing uses", () => {
    const source = sourceOf();
    const dynamic = /^(level|kind|sessionStatus|decision|date|role|criteria|minute|status|event|audit|secret|leak|checks|pass|revoke|mail|error|invite\.language|sessions\.filter|report\.audit\.decided|job\.color)\./;
    const unused = (Object.keys(en) as Key[]).filter((key) => !dynamic.test(key) && !source.includes(`"${key}"`));
    expect(unused).toEqual([]);
  });
});

describe("interpolate", () => {
  it("replaces named values", () => {
    expect(interpolate("{a} and {b}", { a: 1, b: "two" })).toBe("1 and two");
  });

  it("leaves an unknown placeholder alone", () => {
    expect(interpolate("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });

  it("picks the singular only for one", () => {
    expect(interpolate("{n} file|{n} files", { n: 1 })).toBe("1 file");
    expect(interpolate("{n} file|{n} files", { n: 0 })).toBe("0 files");
    expect(interpolate("{n} file|{n} files", { n: 2 })).toBe("2 files");
  });
});

describe("translator", () => {
  it("says the same key in each language", () => {
    expect(translator("en")("common.challenges", { n: 2 })).toBe("2 challenges");
    expect(translator("pt")("common.challenges", { n: 2 })).toBe("2 desafios");
  });

  it("returns the key itself when it is not in the dictionary", () => {
    expect(translator("pt")("not a key" as Key)).toBe("not a key");
  });
});

describe("formatters follow the locale", () => {
  it("writes money", () => {
    expect(money(i18nFor("en"), 5)).toMatch(/5\.00/);
    expect(money(i18nFor("pt"), 5)).toMatch(/5,00/);
  });

  it("writes a relative day", () => {
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000);
    expect(relativeDays(i18nFor("en"), inThreeDays)).toBe("in 3 days");
    expect(relativeDays(i18nFor("pt"), inThreeDays)).toBe("em 3 dias");
  });

  it("writes today with the time", () => {
    const now = new Date();
    expect(when(i18nFor("en"), now)).toMatch(/^today, /);
    expect(when(i18nFor("pt"), now)).toMatch(/^hoje, /);
  });
});
