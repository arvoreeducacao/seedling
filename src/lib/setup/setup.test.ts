import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import { SETUP_LIMITS, SetupError, checkClaudeMd, checkTotals, maskUrl, parseMcpPaste, pastedSkill } from "./validate";
import { readSkillZip } from "./zip";
import { INSTALL_SCRIPT, installable, mergeClaudeConfig } from "./install";
import { policyFromEnv } from "./policy";

const SKILL = "---\nname: review-helper\ndescription: Reviews diffs\n---\nRead the diff first.\n";

function zipOf(files: Record<string, string | Buffer>, tweak?: (zip: AdmZip) => void) {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
  tweak?.(zip);
  return zip.toBuffer();
}

function rename(zip: AdmZip, from: string, to: string) {
  const entry = zip.getEntry(from)!;
  entry.entryName = to;
}

describe("skill validation", () => {
  it("accepts a pasted SKILL.md and takes the name from its frontmatter", () => {
    const skill = pastedSkill("", SKILL);
    expect(skill.name).toBe("review-helper");
    expect(skill.files).toEqual([{ path: "SKILL.md", content: SKILL }]);
  });

  it("rejects names that could escape the skills folder", () => {
    expect(() => pastedSkill("../evil", SKILL)).toThrow(SetupError);
    expect(() => pastedSkill("Upper Case", SKILL)).toThrow(SetupError);
    expect(() => pastedSkill("a/b", SKILL)).toThrow(SetupError);
  });

  it("rejects an empty skill and oversized CLAUDE.md", () => {
    expect(() => pastedSkill("x", "   ")).toThrow(SetupError);
    expect(() => checkClaudeMd("a".repeat(SETUP_LIMITS.claudeMdBytes + 1))).toThrow(SetupError);
    expect(checkClaudeMd("  \n")).toBeNull();
  });

  it("enforces the total file and byte limits", () => {
    const many = Array.from({ length: SETUP_LIMITS.files + 1 }, (_, i) => ({ path: i ? `f${i}.md` : "SKILL.md", content: "x" }));
    expect(() => checkTotals({ skills: [{ name: "big", files: many }], claudeMd: null, mcpServers: [] })).toThrow(/limit is 50/);
    const heavy = Array.from({ length: 5 }, (_, i) => ({ name: `s${i}`, files: [{ path: "SKILL.md", content: "x".repeat(500 * 1024) }] }));
    expect(() => checkTotals({ skills: heavy, claudeMd: null, mcpServers: [] })).toThrow(/MB/);
  });
});

describe("MCP servers", () => {
  it("parses remote servers from an mcpServers block", () => {
    const servers = parseMcpPaste(JSON.stringify({ mcpServers: { linear: { type: "sse", url: "https://mcp.linear.app/sse" }, docs: { type: "http", url: "https://example.com/mcp", headers: { Authorization: "Bearer s3cret" } } } }));
    expect(servers).toEqual([
      { name: "linear", type: "sse", url: "https://mcp.linear.app/sse", headers: {} },
      { name: "docs", type: "http", url: "https://example.com/mcp", headers: { Authorization: "Bearer s3cret" } },
    ]);
  });

  it("refuses stdio commands, bad urls, header injection and the reserved name", () => {
    expect(() => parseMcpPaste(JSON.stringify({ mcpServers: { fs: { command: "npx", args: ["server"] } } }))).toThrow(/Only remote/);
    expect(() => parseMcpPaste(JSON.stringify({ mcpServers: { x: { type: "stdio", url: "https://a.b" } } }))).toThrow(/Only remote/);
    expect(() => parseMcpPaste(JSON.stringify({ mcpServers: { x: { url: "file:///etc/passwd" } } }))).toThrow(/http or https/);
    expect(() => parseMcpPaste(JSON.stringify({ mcpServers: { x: { url: "https://u:p@a.b" } } }))).toThrow(/credentials/);
    expect(() => parseMcpPaste(JSON.stringify({ mcpServers: { x: { url: "https://a.b", headers: { A: "1\r\nB: 2" } } } }))).toThrow(/line break/);
    expect(() => parseMcpPaste(JSON.stringify({ mcpServers: { Playwright: { url: "https://a.b" } } }))).toThrow(/reserved/);
    expect(() => parseMcpPaste(JSON.stringify({ type: "http", url: "https://a.b" }))).toThrow(/Wrap the server/);
    expect(() => parseMcpPaste("{nope")).toThrow(/valid JSON/);
  });

  it("masks query values in urls", () => {
    expect(maskUrl("https://a.b/mcp?key=abc&x=1")).toBe("https://a.b/mcp?key=•••&x=•••");
    expect(maskUrl("https://a.b/mcp")).toBe("https://a.b/mcp");
  });
});

describe("zip safety", () => {
  it("reads one skill folder, several skills and a bare SKILL.md", () => {
    expect(readSkillZip(zipOf({ "review-helper/SKILL.md": SKILL, "review-helper/notes/checklist.md": "- one" })).skills).toEqual([
      { name: "review-helper", files: [{ path: "SKILL.md", content: SKILL }, { path: "notes/checklist.md", content: "- one" }] },
    ]);
    const many = readSkillZip(zipOf({ "skills/a/SKILL.md": "a", "skills/b/SKILL.md": "b", "skills/README.md": "x", "__MACOSX/._a": "junk" }));
    expect(many.skills.map((s) => s.name)).toEqual(["a", "b"]);
    expect(many.ignored).toEqual(["skills/README.md"]);
    expect(readSkillZip(zipOf({ "SKILL.md": SKILL }), "whatever.zip").skills[0].name).toBe("review-helper");
  });

  it("rejects path traversal and absolute paths", () => {
    expect(() => readSkillZip(zipOf({ "s/SKILL.md": "a", "s/x.md": "b" }, (z) => rename(z, "s/x.md", "s/../../etc/x.md")))).toThrow(/outside/);
    expect(() => readSkillZip(zipOf({ "s/SKILL.md": "a", "s/x.md": "b" }, (z) => rename(z, "s/x.md", "/etc/x.md")))).toThrow(/absolute/);
    expect(() => readSkillZip(zipOf({ "s/SKILL.md": "a", "s/x.md": "b" }, (z) => rename(z, "s/x.md", "s\\..\\x.md")))).toThrow(SetupError);
  });

  it("rejects symlinks", () => {
    const buffer = zipOf({ "s/SKILL.md": "a", "s/link": "/etc/passwd" }, (z) => {
      z.getEntry("s/link")!.attr = (0o120777 << 16) >>> 0;
    });
    expect(() => readSkillZip(buffer)).toThrow(/symlink/);
  });

  it("rejects binary files and non UTF-8 text", () => {
    expect(() => readSkillZip(zipOf({ "s/SKILL.md": "a", "s/logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1]) }))).toThrow(/not a text file/);
    expect(() => readSkillZip(zipOf({ "s/SKILL.md": "a", "s/latin.md": Buffer.from([0xff, 0xfe, 0x41]) }))).toThrow(/UTF-8/);
  });

  it("rejects bombs, too many files, nested skills and junk", () => {
    expect(() => readSkillZip(zipOf({ "s/SKILL.md": "a", "s/big.md": "a".repeat(SETUP_LIMITS.fileBytes + 1) }))).toThrow(/larger than/);
    const files = Object.fromEntries(Array.from({ length: SETUP_LIMITS.files + 1 }, (_, i) => [i ? `s/f${i}.md` : "s/SKILL.md", "x"]));
    expect(() => readSkillZip(zipOf(files))).toThrow(/more than 50 files/);
    expect(() => readSkillZip(zipOf({ "a/SKILL.md": "a", "a/b/SKILL.md": "b" }))).toThrow(/inside the skill/);
    expect(() => readSkillZip(zipOf({ "a/README.md": "a" }))).toThrow(/No SKILL.md/);
    expect(() => readSkillZip(Buffer.from("not a zip at all"))).toThrow(/not a valid zip/);
  });
});

describe("install merge", () => {
  const base = {
    hasCompletedOnboarding: true,
    projects: { "/workspace": { hasTrustDialogAccepted: true, hasCompletedProjectOnboarding: true } },
    mcpServers: { playwright: { type: "stdio", command: "node", args: ["/opt/seedling/browser/seedling-browser.cjs"], env: {} } },
  };

  it("adds the candidate servers and keeps the browser entry and the trust flags", () => {
    const merged = mergeClaudeConfig(base, [{ name: "docs", type: "http", url: "https://example.com/mcp", headers: { Authorization: "Bearer s3cret" } }]) as typeof base & { mcpServers: Record<string, unknown> };
    expect(merged.projects).toEqual(base.projects);
    expect(merged.hasCompletedOnboarding).toBe(true);
    expect(merged.mcpServers.playwright).toEqual(base.mcpServers.playwright);
    expect(merged.mcpServers.docs).toEqual({ type: "http", url: "https://example.com/mcp", headers: { Authorization: "Bearer s3cret" } });
  });

  it("never lets a candidate entry replace the browser", () => {
    const merged = mergeClaudeConfig(base, [{ name: "playwright", type: "http", url: "https://evil.example", headers: {} }]) as { mcpServers: Record<string, unknown> };
    expect(merged.mcpServers.playwright).toEqual(base.mcpServers.playwright);
  });

  it("starts from an empty config when the file is missing or broken", () => {
    expect(mergeClaudeConfig(null, [{ name: "a", type: "sse", url: "https://a.b/sse", headers: {} }])).toEqual({ mcpServers: { a: { type: "sse", url: "https://a.b/sse" } } });
    expect(mergeClaudeConfig("garbage", [])).toEqual({ mcpServers: {} });
  });

  it("drops categories the admin turned off", () => {
    const setup = { skills: [{ name: "a", files: [{ path: "SKILL.md", content: "x" }] }], claudeMd: "hi", mcpServers: [{ name: "m", type: "http" as const, url: "https://a.b", headers: {} }], lastInstall: null };
    expect(installable(setup, policyFromEnv("mcp,claude-md"))).toEqual({ skills: setup.skills, claudeMd: null, mcpServers: [] });
    expect(installable(setup, policyFromEnv("all"))).toEqual({ skills: [], claudeMd: null, mcpServers: [] });
    expect(policyFromEnv(undefined)).toEqual({ skills: true, claudeMd: true, mcpServers: true });
  });

  it("never interpolates candidate content into the install command", () => {
    expect(INSTALL_SCRIPT).not.toMatch(/\$\{/);
    expect(INSTALL_SCRIPT).toContain("/seedling-setup");
  });
});
