import { describe, expect, it } from "vitest";
import { BRIDGE_PATH, injectBridge } from "./bridge";

describe("injectBridge", () => {
  it("goes right after the opening head tag", () => {
    expect(injectBridge('<!doctype html><html><head lang="en"><title>x</title></head></html>')).toBe(`<!doctype html><html><head lang="en"><script src="${BRIDGE_PATH}"></script><title>x</title></head></html>`);
  });

  it("follows the doctype when there is no head, and prepends otherwise", () => {
    expect(injectBridge("<!DOCTYPE html><p>hi</p>")).toBe(`<!DOCTYPE html><script src="${BRIDGE_PATH}"></script><p>hi</p>`);
    expect(injectBridge("<p>hi</p>")).toBe(`<script src="${BRIDGE_PATH}"></script><p>hi</p>`);
  });

  it("does not mistake a header element for head", () => {
    expect(injectBridge("<header>x</header>")).toBe(`<script src="${BRIDGE_PATH}"></script><header>x</header>`);
  });
});
