import { describe, expect, it } from "vitest";
import { previewListenPort, resolvePreviewOrigin } from "./env";

describe("preview origin", () => {
  it("defaults to the next port on a local install", () => {
    expect(resolvePreviewOrigin("http://localhost:3100", undefined)).toBe("http://localhost:3101");
    expect(resolvePreviewOrigin("https://seedling.example.com", undefined)).toBe("");
  });

  it("uses the configured origin and refuses the app origin", () => {
    expect(resolvePreviewOrigin("https://seedling.example.com", "https://preview.seedling.example.com/")).toBe("https://preview.seedling.example.com");
    expect(resolvePreviewOrigin("https://seedling.example.com", "https://seedling.example.com")).toBe("");
    expect(resolvePreviewOrigin("http://localhost:3100", "not a url")).toBe("");
  });

  it("listens on a second port only for a loopback origin on another port", () => {
    expect(previewListenPort("http://localhost:3101", 3100, undefined)).toBe(3101);
    expect(previewListenPort("https://preview.seedling.example.com", 3100, undefined)).toBeNull();
    expect(previewListenPort("https://preview.seedling.example.com", 3100, "3101")).toBe(3101);
    expect(previewListenPort("", 3100, undefined)).toBeNull();
  });
});
