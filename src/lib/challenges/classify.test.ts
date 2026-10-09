import { describe, expect, it } from "vitest";
import { classify, findSecrets, hiddenDirOf, parseTestCounts, pickStatement, referenceTarget, statementLeaks, stripCommonRoot, trapsFrom } from "./classify";

describe("classify", () => {
  const statement = pickStatement(["CHALLENGE.md", "README.md", "client/a.js"]);

  it("prefers CHALLENGE.md over README.md as the statement", () => {
    expect(statement).toBe("CHALLENGE.md");
  });

  it("falls back to README.md", () => {
    expect(pickStatement(["README.md", "src/a.js"])).toBe("README.md");
  });

  it("splits files by folder convention", () => {
    expect(classify("CHALLENGE.md", statement)).toBe("statement");
    expect(classify("hidden-tests/a.test.js", statement)).toBe("hidden");
    expect(classify("solution/client/a.js", statement)).toBe("reference");
    expect(classify("RUBRIC.md", statement)).toBe("team");
    expect(classify("seedling.json", statement)).toBe("team");
    expect(classify("tests/a.test.js", statement)).toBe("visible-test");
    expect(classify("client/a.js", statement)).toBe("visible");
    expect(classify("data/sheet.xml", statement)).toBe("visible");
  });

  it("strips a single wrapping folder from a zip", () => {
    expect(stripCommonRoot(["p1/a.md", "p1/b/c.js"]).map((p) => p.to)).toEqual(["a.md", "b/c.js"]);
    expect(stripCommonRoot(["a.md", "b/c.js"]).map((p) => p.to)).toEqual(["a.md", "b/c.js"]);
  });

  it("maps a reference file onto the candidate path", () => {
    expect(referenceTarget("solution/client/a.js")).toBe("client/a.js");
  });

  it("finds the hidden tests folder", () => {
    expect(hiddenDirOf(["client/a.js", "hidden-tests/x.test.js"])).toBe("hidden-tests");
  });
});

describe("legacy Portuguese convention", () => {
  const statement = pickStatement(["ENUNCIADO.md", "README.md", "cliente/a.js"]);

  it("still prefers ENUNCIADO.md over README.md", () => {
    expect(statement).toBe("ENUNCIADO.md");
  });

  it("still splits files by the Portuguese folder names", () => {
    expect(classify("ENUNCIADO.md", statement)).toBe("statement");
    expect(classify("testes-ocultos/a.test.js", statement)).toBe("hidden");
    expect(classify("solucao/cliente/a.js", statement)).toBe("reference");
    expect(classify("RUBRICA.md", statement)).toBe("team");
    expect(classify("testes/a.test.js", statement)).toBe("visible-test");
    expect(referenceTarget("solucao/cliente/a.js")).toBe("cliente/a.js");
    expect(hiddenDirOf(["cliente/a.js", "testes-ocultos/x.test.js"])).toBe("testes-ocultos");
  });

  it("still reads traps from an Armadilhas section", () => {
    expect(trapsFrom("# Rubrica\n## Armadilhas\n- ISBN com hífen\n## Outra\n- nada")).toEqual(["ISBN com hífen"]);
  });
});

describe("rubric and safety", () => {
  it("reads traps from the rubric section", () => {
    const rubric = "# Rubric\n## Traps\n- ISBN with hyphens\n- **Duplicated EPUB**\n## Other\n- nothing";
    expect(trapsFrom(rubric)).toEqual(["ISBN with hyphens", "Duplicated EPUB"]);
  });

  it("flags secrets and .env files", () => {
    const found = findSecrets([
      { path: ".env", content: "X=1" },
      { path: "a.js", content: `const k = "sk-ant-${"a".repeat(30)}"` },
      { path: ".env.example", content: "" },
    ]);
    expect(found).toHaveLength(2);
  });

  it("does not flag a reference file that shares the candidate path", () => {
    expect(statementLeaks("edit src/inventory.js", ["solution/src/inventory.js"], ["src/inventory.js"])).toEqual([]);
  });

  it("flags a statement that cites a private file", () => {
    expect(statementLeaks("see\nsolution/example.js here", ["solution/example.js"])).toEqual(["line 2 mentions solution/example.js"]);
  });
});

describe("parseTestCounts", () => {
  it("reads the node test runner", () => {
    expect(parseTestCounts("# tests 3\n# pass 2\n# fail 1\n", 1)).toEqual({ passed: 2, total: 3 });
    expect(parseTestCounts("ℹ tests 6\nℹ pass 6\nℹ fail 0\n", 0)).toEqual({ passed: 6, total: 6 });
  });

  it("reads pytest", () => {
    expect(parseTestCounts("==== 3 passed, 1 failed in 0.2s ====", 1)).toEqual({ passed: 3, total: 4 });
  });

  it("reads jest and vitest", () => {
    expect(parseTestCounts("Tests:       1 failed, 4 passed, 5 total", 1)).toEqual({ passed: 4, total: 5 });
    expect(parseTestCounts(" Tests  1 failed | 2 passed (3)", 1)).toEqual({ passed: 2, total: 3 });
  });

  it("falls back to the exit code", () => {
    expect(parseTestCounts("ok", 0)).toEqual({ passed: 1, total: 1 });
  });
});
