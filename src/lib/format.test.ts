import { describe, expect, it } from "vitest";
import { i18nFor } from "@/lib/i18n";
import { money, number } from "./format";

const en = i18nFor("en");
const pt = i18nFor("pt");

describe("money", () => {
  it("keeps two decimals by default", () => {
    expect(money(en, 1.5)).toBe("$1.50");
    expect(money(en, 0.004)).toBe("$0.00");
  });

  it("takes a precision for sub-cent costs", () => {
    expect(money(en, 0.004, 3)).toBe("$0.004");
    expect(money(en, 1.2348, 3)).toBe("$1.235");
  });

  it("follows the locale", () => {
    expect(money(pt, 1.5).replace(/ /g, " ")).toBe("US$ 1,50");
    expect(money(pt, 0.004, 3).replace(/ /g, " ")).toBe("US$ 0,004");
  });
});

describe("number", () => {
  it("groups by locale", () => {
    expect(number(en, 12_345)).toBe("12,345");
    expect(number(pt, 12_345).replace(/ /g, " ")).toBe("12.345");
  });
});
