import { describe, expect, it } from "vitest";
import { agentAddress, displayUrl, formatAddress, parseAddress } from "./address";

describe("parseAddress", () => {
  it("reads a bare port", () => {
    expect(parseAddress("3000", null)).toEqual({ port: 3000, path: "/" });
    expect(parseAddress("70000", null)).toBeNull();
  });

  it("reads host and port with or without a scheme", () => {
    expect(parseAddress("localhost:5173/books", null)).toEqual({ port: 5173, path: "/books" });
    expect(parseAddress("http://127.0.0.1:8000/api?x=1", null)).toEqual({ port: 8000, path: "/api?x=1" });
    expect(parseAddress(":4173", null)).toEqual({ port: 4173, path: "/" });
    expect(parseAddress("localhost", null)).toEqual({ port: 80, path: "/" });
  });

  it("refuses other hosts", () => {
    expect(parseAddress("https://example.com", 3000)).toBeNull();
  });

  it("opens html files from the workspace", () => {
    expect(parseAddress("index.html", 3000)).toEqual({ port: 0, path: "/index.html" });
    expect(parseAddress("./public/report.htm#top", null)).toEqual({ port: 0, path: "/public/report.htm#top" });
  });

  it("treats a path as relative to the current page", () => {
    expect(parseAddress("/books/2", 5173)).toEqual({ port: 5173, path: "/books/2" });
    expect(parseAddress("books", 5173)).toEqual({ port: 5173, path: "/books" });
    expect(parseAddress("styles/app.css", 0)).toEqual({ port: 0, path: "/styles/app.css" });
    expect(parseAddress("books", null)).toBeNull();
  });
});

describe("formatAddress", () => {
  it("shows ports as localhost and files as paths", () => {
    expect(formatAddress({ port: 5173, path: "/" })).toBe("localhost:5173");
    expect(formatAddress({ port: 3000, path: "/books?x=1" })).toBe("localhost:3000/books?x=1");
    expect(formatAddress({ port: 0, path: "/public/index.html" })).toBe("public/index.html");
  });
});

describe("agentAddress", () => {
  it("maps what the agent opened to an address the pane can load", () => {
    expect(agentAddress("http://localhost:5173/books?x=1#top")).toEqual({ port: 5173, path: "/books?x=1#top" });
    expect(agentAddress("http://127.0.0.1/")).toEqual({ port: 80, path: "/" });
    expect(agentAddress("file:///workspace/site/index.html")).toEqual({ port: 0, path: "/site/index.html" });
    expect(agentAddress("file:///etc/passwd")).toBeNull();
    expect(agentAddress("https://example.com/a")).toBeNull();
    expect(agentAddress("not a url")).toBeNull();
  });

  it("shows local pages like the address bar and strips the scheme elsewhere", () => {
    expect(displayUrl("http://localhost:5173/books")).toBe("localhost:5173/books");
    expect(displayUrl("file:///workspace/site/index.html")).toBe("site/index.html");
    expect(displayUrl("https://example.com/")).toBe("example.com");
  });
});
