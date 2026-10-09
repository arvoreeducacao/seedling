import { describe, expect, it } from "vitest";
import { forwardedCookie, rewriteLocation, rewriteSetCookie, safePath, withoutFrameAncestors } from "./headers";

describe("preview headers", () => {
  it("never forwards the preview pass or the app's own cookies to the sandbox", () => {
    expect(forwardedCookie("a=1; __seedling_preview=xyz; b=2")).toBe("a=1; b=2");
    expect(forwardedCookie("better-auth.session_token=s; __Secure-better-auth.session_token=s; seedling_candidate=c; seedling.session_token=t; __Secure-seedling.session_data=d; sid=9")).toBe("sid=9");
    expect(forwardedCookie(undefined)).toBe("");
  });

  it("removes frame-ancestors from upstream policies and keeps the rest", () => {
    expect(withoutFrameAncestors("default-src 'self'; frame-ancestors 'self'")).toEqual(["default-src 'self'"]);
    expect(withoutFrameAncestors("frame-ancestors 'none'")).toEqual([]);
    expect(withoutFrameAncestors(undefined)).toEqual([]);
  });

  it("turns absolute redirects to the dev server into paths", () => {
    expect(rewriteLocation("http://localhost:5173/books?x=1", 5173)).toBe("/books?x=1");
    expect(rewriteLocation("http://127.0.0.1/", 3000)).toBe("/");
    expect(rewriteLocation("http://localhost:4000/a", 3000)).toBe("http://localhost:4000/a");
    expect(rewriteLocation("https://example.com/a", 3000)).toBe("https://example.com/a");
    expect(rewriteLocation("/relative", 3000)).toBe("/relative");
  });

  it("strips the cookie domain so it binds to the preview host", () => {
    expect(rewriteSetCookie("sid=1; Domain=localhost; Path=/; HttpOnly")).toBe("sid=1; Path=/; HttpOnly");
  });

  it("only allows same-origin paths for the entry redirect", () => {
    expect(safePath("/books?q=1")).toBe("/books?q=1");
    expect(safePath("//evil.com")).toBe("/evil.com");
    expect(safePath("/\\evil.com")).toBe("/evil.com");
    expect(safePath("https://evil.com")).toBe("/https://evil.com");
    expect(safePath("")).toBe("/");
  });
});
