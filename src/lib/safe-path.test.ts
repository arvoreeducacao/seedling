import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OutsideError, copyTreeNoLinks, lexicalTarget, makeTreeWritable, readInside, resolveInside, statInside, writeInside } from "./safe-path";
import { rawFile } from "./raw-file";

let base: string;
let workspace: string;
let secret: string;
let otherWorkspace: string;

beforeEach(async () => {
  base = await fs.mkdtemp(path.join(os.tmpdir(), "seedling-paths-"));
  workspace = path.join(base, "sessions", "a", "challenge-1");
  otherWorkspace = path.join(base, "sessions", "b", "challenge-1");
  await fs.mkdir(path.join(workspace, "src"), { recursive: true });
  await fs.mkdir(otherWorkspace, { recursive: true });
  secret = path.join(base, "seedling.db");
  await fs.writeFile(secret, "top secret");
  await fs.chmod(secret, 0o600);
  await fs.writeFile(path.join(otherWorkspace, "answer.js"), "other candidate");
  await fs.writeFile(path.join(workspace, "src", "index.js"), "hello");
});

afterEach(async () => {
  await fs.rm(base, { recursive: true, force: true });
});

describe("workspace path guard", () => {
  it("refuses lexical escapes", () => {
    expect(() => lexicalTarget(workspace, "../b/challenge-1/answer.js")).toThrow(OutsideError);
    expect(() => lexicalTarget(workspace, "src/../../x")).toThrow(OutsideError);
    expect(lexicalTarget(workspace, "/src/index.js").target).toBe(path.join(workspace, "src", "index.js"));
  });

  it("reads files inside the workspace, including through links that stay inside", async () => {
    await fs.symlink("src/index.js", path.join(workspace, "alias.js"));
    expect((await readInside(workspace, "src/index.js")).buffer?.toString()).toBe("hello");
    expect((await readInside(workspace, "alias.js")).buffer?.toString()).toBe("hello");
  });

  it("refuses a file link that points outside", async () => {
    await fs.symlink(secret, path.join(workspace, "db"));
    await expect(readInside(workspace, "db")).rejects.toBeInstanceOf(OutsideError);
    await expect(statInside(workspace, "db")).rejects.toBeInstanceOf(OutsideError);
  });

  it("refuses a directory link into another candidate's workspace", async () => {
    await fs.symlink(otherWorkspace, path.join(workspace, "peek"));
    await expect(readInside(workspace, "peek/answer.js")).rejects.toBeInstanceOf(OutsideError);
  });

  it("refuses writes through an escaping file link and leaves the target alone", async () => {
    await fs.symlink(secret, path.join(workspace, "db"));
    await expect(writeInside(workspace, "db", "owned")).rejects.toBeInstanceOf(OutsideError);
    expect(await fs.readFile(secret, "utf8")).toBe("top secret");
  });

  it("refuses writes through an escaping directory link without creating anything outside", async () => {
    await fs.symlink(base, path.join(workspace, "up"));
    await expect(writeInside(workspace, "up/new/evil.txt", "x")).rejects.toBeInstanceOf(OutsideError);
    await expect(fs.stat(path.join(base, "new"))).rejects.toThrow();
  });

  it("creates new files and folders inside", async () => {
    await writeInside(workspace, "lib/deep/file.txt", "ok");
    expect(await fs.readFile(path.join(workspace, "lib", "deep", "file.txt"), "utf8")).toBe("ok");
  });

  it("resolves a missing path to the nearest real parent", async () => {
    const resolved = await resolveInside(workspace, "nope/file.txt", { mustExist: false });
    expect(resolved.target.endsWith(path.join("challenge-1", "nope", "file.txt"))).toBe(true);
  });

  it("does not chmod what a link points at", async () => {
    await fs.symlink(secret, path.join(workspace, "db"));
    await fs.symlink(base, path.join(workspace, "up"));
    await makeTreeWritable(workspace);
    expect((await fs.stat(secret)).mode & 0o777).toBe(0o600);
    expect((await fs.stat(path.join(workspace, "src", "index.js"))).mode & 0o777).toBe(0o666);
  });

  it("copies a workspace for grading without any links", async () => {
    await fs.symlink(secret, path.join(workspace, "db"));
    await fs.symlink(otherWorkspace, path.join(workspace, "peek"));
    const target = path.join(base, "scratch");
    await copyTreeNoLinks(workspace, target);
    expect(await fs.readFile(path.join(target, "src", "index.js"), "utf8")).toBe("hello");
    await expect(fs.lstat(path.join(target, "db"))).rejects.toThrow();
    await expect(fs.lstat(path.join(target, "peek"))).rejects.toThrow();
  });

  it("serves raw files only from inside the workspace", async () => {
    await fs.symlink(secret, path.join(workspace, "db.png"));
    expect((await rawFile(workspace, "db.png", false)).status).toBe(400);
    expect((await rawFile(workspace, "../../b/challenge-1/answer.js", false)).status).toBe(400);
    const ok = await rawFile(workspace, "src/index.js", true);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("hello");
  });
});
