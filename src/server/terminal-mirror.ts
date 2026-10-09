import fs from "node:fs";
import headless from "@xterm/headless";
import serialize from "@xterm/addon-serialize";
import { castPath } from "@/lib/sessions";

const { Terminal } = headless;
const { SerializeAddon } = serialize;

type Op = { kind: "write"; data: string } | { kind: "resize"; cols: number; rows: number };

export class Mirror {
  private term: InstanceType<typeof Terminal>;
  private serializer = new SerializeAddon();
  private ops: Op[] = [];
  private busy = false;
  private waiters: (() => void)[] = [];

  constructor(cols = 120, rows = 32) {
    this.term = new Terminal({ cols, rows, scrollback: 1000, allowProposedApi: true });
    this.term.loadAddon(this.serializer);
  }

  get cols() {
    return this.term.cols;
  }

  get rows() {
    return this.term.rows;
  }

  write(data: string) {
    if (!data) return;
    this.ops.push({ kind: "write", data });
    this.pump();
  }

  resize(cols: number, rows: number) {
    this.ops.push({ kind: "resize", cols, rows });
    this.pump();
  }

  async snapshot() {
    if (this.busy || this.ops.length) await new Promise<void>((resolve) => this.waiters.push(resolve));
    return this.serializer.serialize({ scrollback: 400 });
  }

  dispose() {
    this.term.dispose();
  }

  private pump() {
    if (this.busy) return;
    const op = this.ops.shift();
    if (!op) {
      for (const resolve of this.waiters.splice(0)) resolve();
      return;
    }
    if (op.kind === "resize") {
      if (op.cols !== this.term.cols || op.rows !== this.term.rows) this.term.resize(op.cols, op.rows);
      this.pump();
      return;
    }
    this.busy = true;
    this.term.write(op.data, () => {
      this.busy = false;
      this.pump();
    });
  }
}

export function replayCast(mirror: Mirror, file: string) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (const line of lines.slice(1)) {
    if (!line) continue;
    try {
      const [, kind, data] = JSON.parse(line) as [number, string, string];
      if (kind === "o") mirror.write(data);
      else if (kind === "r") {
        const [cols, rows] = data.split("x").map(Number);
        if (cols > 0 && rows > 0) mirror.resize(cols, rows);
      }
    } catch {}
  }
}

function headerSize(file: string): [number, number] {
  try {
    const fd = fs.openSync(file, "r");
    const buffer = Buffer.alloc(512);
    const read = fs.readSync(fd, buffer, 0, 512, 0);
    fs.closeSync(fd);
    const header = JSON.parse(buffer.subarray(0, read).toString("utf8").split("\n")[0]);
    return [Number(header.width) || 120, Number(header.height) || 32];
  } catch {
    return [120, 32];
  }
}

const globalForMirrors = globalThis as unknown as { seedlingMirrors?: Map<string, Mirror> };
const mirrors = globalForMirrors.seedlingMirrors ?? new Map<string, Mirror>();
globalForMirrors.seedlingMirrors = mirrors;

export function mirrorFor(sessionId: string) {
  let mirror = mirrors.get(sessionId);
  if (!mirror) {
    const file = castPath(sessionId);
    const [cols, rows] = headerSize(file);
    mirror = new Mirror(cols, rows);
    replayCast(mirror, file);
    mirrors.set(sessionId, mirror);
  }
  return mirror;
}
