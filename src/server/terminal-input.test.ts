import { describe, expect, it } from "vitest";
import { filterInput, trackFocusMode } from "./terminal-input";

describe("focus reporting", () => {
  it("follows the last 1004 mode the program set", () => {
    expect(trackFocusMode(false, "\u001b[?1004h")).toBe(true);
    expect(trackFocusMode(true, "\u001b[?2004h\u001b[?1004l")).toBe(false);
    expect(trackFocusMode(false, "\u001b[?1004;2004h")).toBe(true);
    expect(trackFocusMode(true, "plain output")).toBe(true);
  });

  it("drops focus events only when no program asked for them", () => {
    expect(filterInput("\u001b[Ols\r", false)).toBe("ls\r");
    expect(filterInput("\u001b[I", true)).toBe("\u001b[I");
    expect(filterInput("\u001b[A", false)).toBe("\u001b[A");
  });
});
