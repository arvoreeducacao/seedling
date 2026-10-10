import { describe, expect, it } from "vitest";
import { checkDetail, checkTitle } from "./checks";
import { i18nFor } from "./i18n";
import type { ChallengeCheck } from "./db/schema";

const en = i18nFor("en").t;
const pt = i18nFor("pt").t;

describe("check rendering", () => {
  it("says a key-based row in both languages", () => {
    const check: ChallengeCheck = {
      key: "starter-fails",
      ok: true,
      titleMessage: { key: "challenges.check.starterFails" },
      detailMessage: { key: "challenges.check.hiddenRatioPass", params: { passed: 2, n: 5 } },
    };
    expect(checkTitle(en, check)).toBe("The starter code is not already solved");
    expect(checkDetail(en, check)).toBe("2 of 5 hidden tests pass");
    expect(checkTitle(pt, check)).toBe("O código inicial ainda não está resolvido");
    expect(checkDetail(pt, check)).toBe("2 de 5 testes ocultos passam");
  });

  it("uses the singular form for one hidden test", () => {
    const check: ChallengeCheck = {
      key: "reference-passes",
      ok: true,
      titleMessage: { key: "challenges.check.referenceOk" },
      detailMessage: { key: "challenges.check.hiddenRatio", params: { passed: 1, n: 1 } },
    };
    expect(checkDetail(en, check)).toBe("1 of 1 hidden test");
    expect(checkDetail(pt, check)).toBe("1 de 1 teste oculto");
  });

  it("joins a list of findings", () => {
    const check: ChallengeCheck = {
      key: "no-secrets",
      ok: false,
      titleMessage: { key: "challenges.check.noSecretsFail" },
      detailFindings: [
        { key: "challenges.secret.env", params: { path: ".env" } },
        { key: "challenges.secret.anthropic", params: { path: "src/a.js" } },
      ],
    };
    expect(checkTitle(en, check)).toBe("Found something that looks like a secret");
    expect(checkDetail(en, check)).toBe(".env: .env file, src/a.js: Anthropic key");
    expect(checkDetail(pt, check)).toBe(".env: arquivo .env, src/a.js: chave da Anthropic");
  });

  it("says a statement leak with its line", () => {
    const check: ChallengeCheck = {
      key: "statement-leak",
      ok: false,
      titleMessage: { key: "challenges.check.leakFail" },
      detailFindings: [{ key: "challenges.leak", params: { line: 2, path: "solution/example.js" } }],
    };
    expect(checkDetail(en, check)).toBe("line 2 mentions solution/example.js");
    expect(checkDetail(pt, check)).toBe("linha 2 cita solution/example.js");
  });

  it("keeps showing a row written before the keys existed", () => {
    const legacy: ChallengeCheck = {
      key: "reference-passes",
      ok: false,
      title: "The reference solution fails hidden tests",
      detail: "1 of 4 hidden tests",
    };
    expect(checkTitle(pt, legacy)).toBe("The reference solution fails hidden tests");
    expect(checkDetail(pt, legacy)).toBe("1 of 4 hidden tests");
  });

  it("falls back to the sandbox error text when there is no key", () => {
    const check: ChallengeCheck = {
      key: "reference-passes",
      ok: false,
      titleMessage: { key: "challenges.check.runFailed" },
      detail: "docker: no such image",
    };
    expect(checkTitle(pt, check)).toBe("Não foi possível rodar os testes");
    expect(checkDetail(pt, check)).toBe("docker: no such image");
  });

  it("shows an unknown key as itself instead of blanking the row", () => {
    const check: ChallengeCheck = { key: "no-secrets", ok: true, titleMessage: { key: "challenges.check.gone" } };
    expect(checkTitle(en, check)).toBe("challenges.check.gone");
    expect(checkDetail(en, check)).toBe("");
  });
});
