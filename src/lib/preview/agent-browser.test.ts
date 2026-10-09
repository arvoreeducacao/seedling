import { describe, expect, it } from "vitest";
import { pickPage } from "./agent-browser";

describe("pickPage", () => {
  it("takes the first real page the agent opened", () => {
    expect(
      pickPage([
        { type: "page", url: "about:blank", webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/A" },
        { type: "service_worker", url: "http://localhost:5173/sw.js", webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/B" },
        { type: "page", url: "http://localhost:5173/books", title: "Books", webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/C1-d" },
      ]),
    ).toEqual({ url: "http://localhost:5173/books", title: "Books", socketPath: "/devtools/page/C1-d" });
  });

  it("ignores blank or odd targets and garbage", () => {
    expect(pickPage([{ type: "page", url: "about:blank", webSocketDebuggerUrl: "ws://x/devtools/page/A" }])).toBeNull();
    expect(pickPage([{ type: "page", url: "https://a.com", webSocketDebuggerUrl: "ws://x/devtools/browser/../../etc" }])).toBeNull();
    expect(pickPage({ nope: true })).toBeNull();
  });
});
