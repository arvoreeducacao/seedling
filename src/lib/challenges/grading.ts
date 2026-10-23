import fs from "node:fs/promises";
import path from "node:path";

// Files a test runner loads on its own: whoever controls them controls the result.
const RUNNER_FILE = /(^|\/)(conftest\.py|sitecustomize\.py|usercustomize\.py)$|^(pytest\.ini|tox\.ini|setup\.cfg|pyproject\.toml|\.npmrc|\.yarnrc|\.yarnrc\.yml|bunfig\.toml|\.mocharc(\.[a-z]+)?|(jest|vitest|vite|babel)\.(config|setup)\.[a-z]+)$/;
const SKIP_DIRS = new Set([".git", "node_modules", ".venv", "venv"]);
const HIDDEN_ROOT = /^(.*?(?:hidden-tests|hidden_tests|hidden|testes-ocultos|testes_ocultos))(\/|$)/i;

export function isRunnerFile(rel: string) {
  return RUNNER_FILE.test(rel);
}

export function hiddenRoots(hiddenPaths: string[]) {
  return [...new Set(hiddenPaths.map((p) => p.match(HIDDEN_ROOT)?.[1]).filter((p): p is string => Boolean(p)))];
}

async function walk(root: string, rel = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(path.join(root, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...(await walk(root, child)));
    } else if (entry.isFile()) out.push(child);
  }
  return out;
}

async function same(a: string, b: string) {
  const [x, y] = await Promise.all([fs.readFile(a).catch(() => null), fs.readFile(b).catch(() => null)]);
  return Boolean(x && y && x.equals(y));
}

async function readJson(file: string) {
  try {
    const json = JSON.parse(await fs.readFile(file, "utf8"));
    return json && typeof json === "object" && !Array.isArray(json) ? json : null;
  } catch {
    return null;
  }
}

/**
 * Puts the test harness back the way the challenge shipped it before the hidden tests run:
 * the hidden folders are emptied, runner config and hook files go back to the starter version
 * (or away, when the starter had none) and the root package.json gets the starter scripts.
 * Returns what it changed, so the report can show it.
 */
export async function resetHarness(dir: string, starter: Map<string, string>, hiddenPaths: string[]) {
  const changed: string[] = [];
  for (const root of hiddenRoots(hiddenPaths)) {
    const target = path.join(dir, root);
    const stat = await fs.lstat(target).catch(() => null);
    if (!stat) continue;
    const extra = stat.isDirectory() ? (await walk(target)).map((f) => `${root}/${f}`).filter((f) => !hiddenPaths.includes(f)) : [root];
    changed.push(...extra);
    await fs.rm(target, { recursive: true, force: true });
  }
  for (const rel of await walk(dir)) {
    if (!isRunnerFile(rel)) continue;
    const source = starter.get(rel);
    if (source && (await same(source, path.join(dir, rel)))) continue;
    changed.push(rel);
    if (source) await fs.copyFile(source, path.join(dir, rel));
    else await fs.rm(path.join(dir, rel), { force: true });
  }
  for (const [rel, source] of starter) {
    if (!isRunnerFile(rel)) continue;
    const target = path.join(dir, rel);
    if (await fs.lstat(target).catch(() => null)) continue;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
    changed.push(rel);
  }
  const shipped = starter.get("package.json");
  const pkg = await readJson(path.join(dir, "package.json"));
  if (shipped && pkg) {
    const original = (await readJson(shipped))?.scripts;
    if (JSON.stringify(pkg.scripts ?? null) !== JSON.stringify(original ?? null)) {
      pkg.scripts = original;
      await fs.writeFile(path.join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
      changed.push("package.json (scripts)");
    }
  }
  return changed;
}
