import { describe, expect, it } from "vitest";
import { blockedPath, crossSiteWriteBlocked, upgradeAllowed } from "./origin";

const app = "https://seedling.example.com";

describe("cross-site writes", () => {
  it("blocks writes coming from the preview origin or any other site", () => {
    expect(crossSiteWriteBlocked({ method: "POST", path: "/api/admin/challenges", origin: "https://preview-seedling.example.com", host: "seedling.example.com", appUrl: app })).toBe(true);
    expect(crossSiteWriteBlocked({ method: "POST", path: "/sessions", origin: "https://evil.test", host: "seedling.example.com", appUrl: app })).toBe(true);
    expect(crossSiteWriteBlocked({ method: "PUT", path: "/api/s/x/file", origin: "null", host: "seedling.example.com", appUrl: app })).toBe(true);
    expect(crossSiteWriteBlocked({ method: "POST", path: "/auth/logout", fetchSite: "same-site", host: "seedling.example.com", appUrl: app })).toBe(true);
  });

  it("lets the app, safe methods, the sandbox gateway and origin-less clients through", () => {
    expect(crossSiteWriteBlocked({ method: "POST", path: "/sessions", origin: app, host: "seedling.example.com", appUrl: app })).toBe(false);
    expect(crossSiteWriteBlocked({ method: "POST", path: "/sessions", origin: "http://localhost:3400", host: "localhost:3400", appUrl: "http://localhost:3400" })).toBe(false);
    expect(crossSiteWriteBlocked({ method: "GET", path: "/api/s/x/file", origin: "https://evil.test", host: "seedling.example.com", appUrl: app })).toBe(false);
    expect(crossSiteWriteBlocked({ method: "POST", path: "/api/gateway/anthropic/v1/messages", origin: "https://evil.test", host: "seedling.example.com", appUrl: app })).toBe(false);
    expect(crossSiteWriteBlocked({ method: "POST", path: "/api/gateway/anthropic/v1/messages", host: "seedling.example.com", appUrl: app })).toBe(false);
  });

  it("checks websocket origins", () => {
    expect(upgradeAllowed(app, "seedling.example.com", app)).toBe(true);
    expect(upgradeAllowed("https://preview-seedling.example.com", "seedling.example.com", app)).toBe(false);
    expect(upgradeAllowed(undefined, "seedling.example.com", app)).toBe(true);
  });

  it("turns off the image optimizer", () => {
    expect(blockedPath("/_next/image")).toBe(true);
    expect(blockedPath("/_next/static/x.js")).toBe(false);
  });
});
