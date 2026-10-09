import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Mirror, replayCast } from "./terminal-mirror";

describe("Mirror", () => {
  it("rebuilds the screen at the size the candidate had when it was drawn", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mirror-"));
    const file = path.join(dir, "terminal.cast");
    const lines = [
      JSON.stringify({ version: 2, width: 120, height: 32 }),
      JSON.stringify([0.1, "r", "20x5"]),
      JSON.stringify([0.2, "o", "12345678901234567890abc"]),
    ];
    fs.writeFileSync(file, lines.join("\n") + "\n");
    const mirror = new Mirror(120, 32);
    replayCast(mirror, file);
    const screen = await mirror.snapshot();
    expect(mirror.cols).toBe(20);
    expect(mirror.rows).toBe(5);
    expect(screen).toContain("12345678901234567890");
    expect(screen).toContain("abc");
  });

  it("applies writes and resizes in order", async () => {
    const mirror = new Mirror(40, 10);
    mirror.write("first line\r\n");
    mirror.resize(30, 6);
    mirror.write("second line");
    const screen = await mirror.snapshot();
    expect(mirror.cols).toBe(30);
    expect(screen).toContain("first line");
    expect(screen).toContain("second line");
  });
});
