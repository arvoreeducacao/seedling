import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export class OutsideError extends Error {
  constructor(message = "path outside the workspace") {
    super(message);
  }
}

export function isInside(root: string, target: string) {
  return target === root || target.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

export function lexicalTarget(root: string, relative: string) {
  const base = path.resolve(root);
  const target = path.resolve(base, String(relative ?? "").replace(/^[/\\]+/, ""));
  if (!isInside(base, target)) throw new OutsideError();
  return { base, target };
}

async function nearestExisting(target: string) {
  let current = target;
  for (;;) {
    try {
      return { real: await fs.realpath(current), rest: path.relative(current, target) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

export async function resolveInside(root: string, relative: string, options: { mustExist?: boolean } = {}) {
  const { base, target } = lexicalTarget(root, relative);
  const realRoot = await fs.realpath(base);
  const found = options.mustExist === false ? await nearestExisting(target) : { real: await fs.realpath(target), rest: "" };
  if (!isInside(realRoot, found.real)) throw new OutsideError();
  const real = found.rest ? path.join(found.real, found.rest) : found.real;
  if (!isInside(realRoot, real)) throw new OutsideError();
  return { root: realRoot, target: real };
}

async function descriptorPath(fd: number) {
  if (process.platform !== "linux") return null;
  return fs.readlink(`/proc/self/fd/${fd}`).catch(() => null);
}

async function assertHandleInside(handle: fs.FileHandle, root: string, expected: string) {
  const viaProc = await descriptorPath(handle.fd);
  if (viaProc !== null) {
    if (!isInside(root, viaProc)) throw new OutsideError();
    return;
  }
  const [opened, again] = await Promise.all([handle.stat(), fs.realpath(expected).then((p) => (isInside(root, p) ? fs.stat(p) : null))]);
  if (!again || opened.ino !== again.ino || opened.dev !== again.dev) throw new OutsideError();
}

export async function openInside(root: string, relative: string) {
  const resolved = await resolveInside(root, relative);
  const handle = await fs.open(resolved.target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    await assertHandleInside(handle, resolved.root, resolved.target);
    return { handle, ...resolved };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

export async function statInside(root: string, relative: string) {
  const resolved = await resolveInside(root, relative);
  return { stat: await fs.lstat(resolved.target), ...resolved };
}

export async function readInside(root: string, relative: string, maxBytes = Infinity) {
  const { handle, target } = await openInside(root, relative);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("not a file");
    if (stat.size > maxBytes) return { target, stat, buffer: null };
    return { target, stat, buffer: await handle.readFile() };
  } finally {
    await handle.close();
  }
}

export async function writeInside(root: string, relative: string, content: string | Uint8Array, mode = 0o666) {
  const first = await resolveInside(root, relative, { mustExist: false });
  await fs.mkdir(path.dirname(first.target), { recursive: true });
  const resolved = await resolveInside(root, relative, { mustExist: false });
  const handle = await fs.open(resolved.target, constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW, mode);
  try {
    await assertHandleInside(handle, resolved.root, resolved.target);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("not a file");
    await handle.truncate(0);
    await handle.writeFile(content);
    await handle.chmod(mode).catch(() => {});
  } finally {
    await handle.close();
  }
  return resolved.target;
}

export async function walkNoFollow(root: string, visit: (abs: string, stat: import("node:fs").Stats) => Promise<void>) {
  const walk = async (p: string): Promise<void> => {
    const stat = await fs.lstat(p);
    if (stat.isSymbolicLink()) return;
    await visit(p, stat);
    if (stat.isDirectory()) for (const child of await fs.readdir(p)) await walk(path.join(p, child));
  };
  await walk(root);
}

export async function makeTreeWritable(root: string) {
  await walkNoFollow(root, async (p, stat) => {
    if (stat.isDirectory()) await fs.chmod(p, 0o777);
    else if (stat.isFile()) await fs.chmod(p, 0o666);
  });
}

export async function copyTreeNoLinks(source: string, destination: string) {
  await fs.cp(source, destination, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
    filter: async (src) => {
      const stat = await fs.lstat(src).catch(() => null);
      return Boolean(stat && (stat.isDirectory() || stat.isFile()));
    },
  });
}
