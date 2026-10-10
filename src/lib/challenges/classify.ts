export type FileRole = "statement" | "visible" | "visible-test" | "hidden" | "reference" | "team";

const ignored = /(^|\/)(node_modules|\.git|__MACOSX|\.venv|__pycache__|dist|\.next)(\/|$)|(^|\/)\.DS_Store$/;
const hidden = /(^|\/)(hidden-tests|hidden_tests|hidden|testes-ocultos|testes_ocultos)(\/|$)/i;
const reference = /(^|\/)(solution|reference|solucao|solução|referencia|gabarito|_gabaritos)(\/|$)/i;
const team = /(^|\/)(rubric|rubrica|defense|defesa|interviewer|team|time)(\.md|\/)|^seedling\.json$/i;
const visibleTest = /(^|\/)(test|tests|__tests__|spec|testes)(\/|$)|\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.py$/i;
const statement = /^(challenge|statement|readme|enunciado|desafio)\.md$/i;

export function isIgnored(path: string) {
  return ignored.test(path);
}

export function classify(path: string, statementPath: string | null): FileRole {
  if (path === statementPath) return "statement";
  if (hidden.test(path)) return "hidden";
  if (reference.test(path)) return "reference";
  if (team.test(path)) return "team";
  if (visibleTest.test(path)) return "visible-test";
  return "visible";
}

export function pickStatement(paths: string[]) {
  const roots = paths.filter((p) => !p.includes("/") && statement.test(p));
  const order = ["challenge.md", "statement.md", "enunciado.md", "desafio.md", "readme.md"];
  return roots.sort((a, b) => order.indexOf(a.toLowerCase()) - order.indexOf(b.toLowerCase()))[0] ?? null;
}

export function stripCommonRoot(paths: string[]) {
  const first = paths[0]?.split("/")[0];
  if (!first || !paths.every((p) => p.startsWith(`${first}/`))) return paths.map((p) => ({ from: p, to: p }));
  return paths.map((p) => ({ from: p, to: p.slice(first.length + 1) }));
}

export function referenceTarget(path: string) {
  const parts = path.split("/");
  const index = parts.findIndex((part) => reference.test(`${part}/`));
  return index >= 0 ? parts.slice(index + 1).join("/") : path;
}

export function hiddenDirOf(paths: string[]) {
  const match = paths.map((p) => p.match(/^(.*?(?:hidden-tests|hidden_tests|hidden|testes-ocultos|testes_ocultos))(\/|$)/i)?.[1]).find(Boolean);
  return match ?? null;
}

export function trapsFrom(rubric: string | null) {
  if (!rubric) return [];
  const lines = rubric.split("\n");
  const traps: string[] = [];
  let inSection = false;
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      inSection = /trap|pitfall|armadilha|pegadinha/i.test(heading[1]);
      continue;
    }
    const item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (inSection && item) traps.push(item[1].replace(/\*\*/g, "").trim());
  }
  return traps;
}

export type SecretKind = "env" | "anthropic" | "openai" | "aws" | "github" | "privateKey" | "slack";
export type SecretFinding = { kind: SecretKind; path: string };
export type StatementLeak = { line: number; path: string };

const secretPatterns: [SecretKind, RegExp][] = [
  ["anthropic", /sk-ant-[a-zA-Z0-9_-]{20,}/],
  ["openai", /sk-(proj-)?[a-zA-Z0-9]{32,}/],
  ["aws", /AKIA[0-9A-Z]{16}/],
  ["github", /gh[pousr]_[A-Za-z0-9]{36,}/],
  ["privateKey", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["slack", /xox[baprs]-[A-Za-z0-9-]{10,}/],
];

export function findSecrets(files: { path: string; content: string }[]): SecretFinding[] {
  const found: SecretFinding[] = [];
  for (const file of files) {
    if (/(^|\/)\.env(\.|$)/.test(file.path) && !/\.example$/.test(file.path)) found.push({ kind: "env", path: file.path });
    for (const [kind, pattern] of secretPatterns) {
      if (pattern.test(file.content)) found.push({ kind, path: file.path });
    }
  }
  return found;
}

export function statementLeaks(statementText: string, privatePaths: string[], visiblePaths: string[] = []): StatementLeak[] {
  const lines = statementText.split("\n");
  const leaks: StatementLeak[] = [];
  const visible = new Set(visiblePaths);
  for (const path of privatePaths) {
    const name = path.split("/").slice(-2).join("/");
    const collides = [...visible].some((v) => v === name || v.endsWith(`/${name}`));
    const index = lines.findIndex((l) => l.includes(path) || (!collides && name.length > 6 && l.includes(name)));
    if (index >= 0) leaks.push({ line: index + 1, path });
  }
  return leaks;
}

export function parseTestCounts(output: string, exitCode: number) {
  const n = (re: RegExp) => {
    const m = output.match(re);
    return m ? Number(m[1]) : null;
  };
  const nodePass = n(/(?:^|\n)\s*(?:#|ℹ)\s*pass\s+(\d+)/);
  const nodeFail = n(/(?:^|\n)\s*(?:#|ℹ)\s*fail\s+(\d+)/);
  if (nodePass !== null || nodeFail !== null) {
    const passed = nodePass ?? 0;
    return { passed, total: passed + (nodeFail ?? 0) };
  }
  const pyPassed = n(/(\d+) passed/);
  const pyFailed = n(/(\d+) failed/);
  const pyErrors = n(/(\d+) errors?\b/);
  if (pyPassed !== null || pyFailed !== null) {
    const passed = pyPassed ?? 0;
    return { passed, total: passed + (pyFailed ?? 0) + (pyErrors ?? 0) };
  }
  const jest = output.match(/Tests:\s+(?:(\d+) failed, )?(?:(\d+) skipped, )?(?:(\d+) passed, )?(\d+) total/);
  if (jest) return { passed: Number(jest[3] ?? 0), total: Number(jest[4]) };
  const vitest = output.match(/Tests\s+(?:(\d+) failed\s*\|\s*)?(\d+) passed\s*\((\d+)\)/);
  if (vitest) return { passed: Number(vitest[2]), total: Number(vitest[3]) };
  return { passed: exitCode === 0 ? 1 : 0, total: 1 };
}
