export type TestLine = { name: string; passed: boolean; meta: string | null };

const patterns: { re: RegExp; passed: (m: RegExpMatchArray) => boolean; name: (m: RegExpMatchArray) => string; meta?: (m: RegExpMatchArray) => string | null }[] = [
  { re: /^\s*([✔✓√])\s+(.+?)(?:\s+\(([\d.]+\s*m?s)\))?\s*$/, passed: () => true, name: (m) => m[2], meta: (m) => m[3] ?? null },
  { re: /^\s*([✖✗✕×])\s+(.+?)(?:\s+\(([\d.]+\s*m?s)\))?\s*$/, passed: () => false, name: (m) => m[2], meta: (m) => m[3] ?? null },
  { re: /^\s*(not ok|ok)\s+\d+\s*-?\s*(.+?)\s*(?:#.*)?$/, passed: (m) => m[1] === "ok", name: (m) => m[2] },
  { re: /^(\S+::\S+)\s+(PASSED|FAILED|ERROR)/, passed: (m) => m[2] === "PASSED", name: (m) => m[1].split("::").slice(1).join(" › ") },
];

export function parseTestLines(output: string): TestLine[] {
  const clean = output.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
  const seen = new Set<string>();
  const out: TestLine[] = [];
  for (const line of clean.split("\n")) {
    for (const p of patterns) {
      const m = line.match(p.re);
      if (!m) continue;
      const name = p.name(m).trim();
      if (!name || /^(tests?|suites?|pass|fail)\s+\d+/i.test(name)) break;
      const key = `${name}:${p.passed(m)}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ name, passed: p.passed(m), meta: p.meta?.(m) ?? null });
      }
      break;
    }
  }
  return out;
}
