import { describe, expect, it } from "vitest";
import { PASS_TTL_MS, passLifetime, previewPortAllowed } from "./pass";

describe("preview pass", () => {
  it("never outlives the session by more than a few minutes", () => {
    expect(passLifetime(10 * 60_000)).toBe(15 * 60_000);
    expect(passLifetime(0)).toBe(5 * 60_000);
    expect(passLifetime(24 * 60 * 60_000)).toBe(PASS_TTL_MS);
  });

  it("keeps the agent browser's control ports out of the preview", () => {
    expect(previewPortAllowed(5173)).toBe(true);
    expect(previewPortAllowed(0)).toBe(true);
    expect(previewPortAllowed(9222)).toBe(false);
    expect(previewPortAllowed(9223)).toBe(false);
    expect(previewPortAllowed(70000)).toBe(false);
    expect(previewPortAllowed(1.5)).toBe(false);
  });
});
