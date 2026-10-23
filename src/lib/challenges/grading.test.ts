import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hiddenRoots, isRunnerFile, resetHarness } from "./grading";
import { parseTestCounts } from "./classify";

const dirs: string[] = [];

async function tree(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "seedling-grading-"));
  dirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), content);
  }
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe("resetHarness", () => {
  it("undoes what a candidate could do to fake the hidden tests", async () => {
    const shipped = await tree({ "package.json": JSON.stringify({ scripts: { test: "node --test" } }), "pytest.ini": "[pytest]\n", "src/app.js": "export {}" });
    const starter = new Map(["package.json", "pytest.ini", "src/app.js"].map((p) => [p, path.join(shipped, p)]));
    const work = await tree({
      "package.json": JSON.stringify({ name: "x", scripts: { test: "echo '# pass 99'" }, dependencies: { a: "1" } }),
      "pytest.ini": "[pytest]\naddopts = -p no:cacheprovider\n",
      "conftest.py": "def pytest_runtest_makereport(): ...",
      "src/deep/conftest.py": "x",
      "hidden-tests/zz.test.js": "fake",
      "hidden-tests/inventory.test.js": "candidate copy",
      "src/app.js": "export const fixed = true",
      "node_modules/pkg/conftest.py": "left alone",
    });
    const changed = await resetHarness(work, starter, ["hidden-tests/inventory.test.js"]);
    expect(changed.sort()).toEqual(["conftest.py", "hidden-tests/zz.test.js", "package.json (scripts)", "pytest.ini", "src/deep/conftest.py"]);
    await expect(fs.access(path.join(work, "hidden-tests"))).rejects.toThrow();
    await expect(fs.access(path.join(work, "conftest.py"))).rejects.toThrow();
    expect(await fs.readFile(path.join(work, "pytest.ini"), "utf8")).toBe("[pytest]\n");
    const pkg = JSON.parse(await fs.readFile(path.join(work, "package.json"), "utf8"));
    expect(pkg).toEqual({ name: "x", scripts: { test: "node --test" }, dependencies: { a: "1" } });
    expect(await fs.readFile(path.join(work, "src/app.js"), "utf8")).toBe("export const fixed = true");
    expect(await fs.readFile(path.join(work, "node_modules/pkg/conftest.py"), "utf8")).toBe("left alone");
  });

  it("puts back a runner file the candidate deleted and leaves an untouched tree alone", async () => {
    const shipped = await tree({ "vitest.config.ts": "export default {}" });
    const starter = new Map([["vitest.config.ts", path.join(shipped, "vitest.config.ts")]]);
    const deleted = await tree({ "src/a.ts": "" });
    expect(await resetHarness(deleted, starter, [])).toEqual(["vitest.config.ts"]);
    const clean = await tree({ "vitest.config.ts": "export default {}" });
    expect(await resetHarness(clean, starter, [])).toEqual([]);
  });

  it("knows the runner files and the hidden folders", () => {
    expect(["conftest.py", "a/b/conftest.py", "pyproject.toml", ".npmrc", "jest.config.js", "vitest.setup.ts"].every(isRunnerFile)).toBe(true);
    expect(["src/config.py", "a/pyproject.toml", "README.md"].some(isRunnerFile)).toBe(false);
    expect(hiddenRoots(["hidden-tests/a.test.js", "hidden-tests/b/c.js", "pkg/testes_ocultos/x.py"])).toEqual(["hidden-tests", "pkg/testes_ocultos"]);
  });
});

describe("parseTestCounts", () => {
  it("reads the runner's summary, not a fake one printed earlier", () => {
    expect(parseTestCounts("# pass 999\n# fail 0\n...\n# pass 3\n# fail 2\n", 1)).toEqual({ passed: 3, total: 5 });
    expect(parseTestCounts("100 passed\n===== 2 passed, 1 failed in 0.1s", 1)).toEqual({ passed: 2, total: 3 });
  });
});
