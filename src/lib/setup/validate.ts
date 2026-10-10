import type { SetupMcpServer, SetupSkill, SetupSkillFile } from "@/lib/db/schema";
import { AppError } from "@/lib/i18n";

export const SETUP_LIMITS = {
  totalBytes: 2 * 1024 * 1024,
  files: 50,
  fileBytes: 512 * 1024,
  skills: 20,
  claudeMdBytes: 256 * 1024,
  mcpServers: 10,
  headers: 10,
  headerValueBytes: 4096,
  zipEntries: 200,
};

export const RESERVED_MCP_NAMES = new Set(["playwright"]);

export class SetupError extends AppError {}

const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MCP_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,128}$/;
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._ -]{0,127}$/;

const utf8 = new TextDecoder("utf-8", { fatal: true });

export function byteLength(text: string) {
  return Buffer.byteLength(text, "utf8");
}

export function validSkillName(name: string) {
  return SKILL_NAME.test(name);
}

export function skillNameFrom(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function cleanRelativePath(raw: string) {
  if (raw.includes("\0") || raw.includes("\\")) throw new SetupError("setup.pathInvalid", { path: printable(raw) });
  if (raw.startsWith("/") || /^[A-Za-z]:/.test(raw)) throw new SetupError("setup.pathAbsolute", { path: printable(raw) });
  const parts = raw.split("/").filter((p) => p !== "" && p !== ".");
  if (!parts.length) throw new SetupError("setup.pathEmpty");
  for (const part of parts) {
    if (part === "..") throw new SetupError("setup.pathOutside", { path: printable(raw) });
    if (!SEGMENT.test(part)) throw new SetupError("setup.pathUnsupported", { path: printable(raw) });
  }
  if (parts.length > 8) throw new SetupError("setup.pathTooDeep", { path: printable(raw) });
  return parts.join("/");
}

export function printable(text: string) {
  return text.replace(/[\u0000-\u001f\u007f]/g, "?").slice(0, 120);
}

export function decodeText(buffer: Buffer, label: string) {
  if (buffer.includes(0)) throw new SetupError("setup.notText", { label });
  try {
    return utf8.decode(buffer);
  } catch {
    throw new SetupError("setup.notUtf8", { label });
  }
}

export function frontmatterName(skillMd: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd);
  if (!match) return null;
  const line = /^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(match[1]);
  return line ? line[1].trim() : null;
}

export function checkSkill(skill: SetupSkill): SetupSkill {
  if (!validSkillName(skill.name)) throw new SetupError("setup.skillNameInvalid", { name: printable(skill.name) });
  if (!skill.files.length) throw new SetupError("setup.skillNoFiles", { name: skill.name });
  const seen = new Set<string>();
  const files: SetupSkillFile[] = [];
  for (const file of skill.files) {
    const path = cleanRelativePath(file.path);
    if (seen.has(path)) throw new SetupError("setup.skillDuplicatePath", { name: skill.name, path });
    seen.add(path);
    if (byteLength(file.content) > SETUP_LIMITS.fileBytes) throw new SetupError("setup.fileTooBig", { path: `${skill.name}/${path}`, kb: SETUP_LIMITS.fileBytes / 1024 });
    if (file.content.includes("\0")) throw new SetupError("setup.fileNotText", { path: `${skill.name}/${path}` });
    files.push({ path, content: file.content });
  }
  const main = files.find((f) => f.path === "SKILL.md");
  if (!main) throw new SetupError("setup.skillNeedsSkillMd", { name: skill.name });
  if (!main.content.trim()) throw new SetupError("setup.skillMdEmpty", { name: skill.name });
  files.sort((a, b) => Number(b.path === "SKILL.md") - Number(a.path === "SKILL.md") || a.path.localeCompare(b.path));
  return { name: skill.name, files };
}

export function pastedSkill(name: unknown, content: unknown): SetupSkill {
  if (typeof content !== "string" || !content.trim()) throw new SetupError("setup.pasteSkillMd");
  const fromBody = frontmatterName(content);
  const raw = typeof name === "string" && name.trim() ? name.trim() : fromBody ?? "";
  if (!raw) throw new SetupError("setup.skillNeedsName");
  return checkSkill({ name: raw, files: [{ path: "SKILL.md", content }] });
}

export function checkClaudeMd(content: unknown) {
  if (typeof content !== "string") throw new SetupError("setup.claudeMdMustBeText");
  if (content.includes("\0")) throw new SetupError("setup.claudeMdNotText");
  if (byteLength(content) > SETUP_LIMITS.claudeMdBytes) throw new SetupError("setup.claudeMdTooBig", { kb: SETUP_LIMITS.claudeMdBytes / 1024 });
  return content.trim() ? content : null;
}

function checkUrl(raw: unknown, name: string) {
  if (typeof raw !== "string" || !raw.trim()) throw new SetupError("setup.mcpNeedsUrl", { name });
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new SetupError("setup.mcpBadUrl", { name });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SetupError("setup.mcpUrlScheme", { name });
  if (url.username || url.password) throw new SetupError("setup.mcpUrlCredentials", { name });
  if (url.href.length > 2048) throw new SetupError("setup.mcpUrlTooLong", { name });
  return url.href;
}

function checkHeaders(raw: unknown, name: string) {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) throw new SetupError("setup.mcpHeadersObject", { name });
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > SETUP_LIMITS.headers) throw new SetupError("setup.mcpTooManyHeaders", { name, max: SETUP_LIMITS.headers });
  const headers: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!HEADER_NAME.test(key)) throw new SetupError("setup.headerNameInvalid", { header: printable(key) });
    if (typeof value !== "string") throw new SetupError("setup.headerMustBeText", { header: key, name });
    if (/[\r\n\0]/.test(value)) throw new SetupError("setup.headerLineBreak", { header: key, name });
    if (byteLength(value) > SETUP_LIMITS.headerValueBytes) throw new SetupError("setup.headerTooLong", { header: key, name });
    headers[key] = value;
  }
  return headers;
}

export function checkMcpServer(name: string, raw: unknown): SetupMcpServer {
  if (!MCP_NAME.test(name)) throw new SetupError("setup.mcpNameInvalid", { name: printable(name) });
  if (RESERVED_MCP_NAMES.has(name.toLowerCase())) throw new SetupError("setup.mcpNameReserved", { name });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new SetupError("setup.mcpMustBeObject", { name });
  const config = raw as Record<string, unknown>;
  if ("command" in config || "args" in config || config.type === "stdio") throw new SetupError("setup.mcpLocalCommand", { name });
  const type = config.type ?? config.transport ?? "http";
  if (type !== "http" && type !== "sse" && type !== "streamable-http") throw new SetupError("setup.mcpBadType", { name, type: printable(String(type)) });
  return { name, type: type === "sse" ? "sse" : "http", url: checkUrl(config.url, name), headers: checkHeaders(config.headers, name) };
}

export function parseMcpPaste(text: unknown): SetupMcpServer[] {
  if (typeof text !== "string" || !text.trim()) throw new SetupError("setup.mcpPasteJson");
  if (byteLength(text) > 64 * 1024) throw new SetupError("setup.mcpConfigTooLarge");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SetupError("setup.mcpNotJson");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new SetupError("setup.mcpExpectedObject");
  const root = parsed as Record<string, unknown>;
  const map = (root.mcpServers ?? root.servers ?? root) as unknown;
  if (!map || typeof map !== "object" || Array.isArray(map)) throw new SetupError("setup.mcpExpectedServers");
  const entries = Object.entries(map as Record<string, unknown>);
  if (!entries.length) throw new SetupError("setup.mcpNoServers");
  if ("url" in (map as object) || "type" in (map as object)) throw new SetupError("setup.mcpWrapServer");
  return entries.map(([name, config]) => checkMcpServer(name, config));
}

export function setupTotals(input: { skills: SetupSkill[]; claudeMd: string | null; mcpServers: SetupMcpServer[] }) {
  const files = input.skills.reduce((n, s) => n + s.files.length, 0) + (input.claudeMd ? 1 : 0);
  const bytes =
    input.skills.reduce((n, s) => n + s.files.reduce((m, f) => m + byteLength(f.path) + byteLength(f.content), 0), 0) +
    (input.claudeMd ? byteLength(input.claudeMd) : 0) +
    byteLength(JSON.stringify(input.mcpServers));
  return { files, bytes };
}

export function checkTotals(input: { skills: SetupSkill[]; claudeMd: string | null; mcpServers: SetupMcpServer[] }) {
  if (input.skills.length > SETUP_LIMITS.skills) throw new SetupError("setup.tooManySkills", { max: SETUP_LIMITS.skills });
  if (input.mcpServers.length > SETUP_LIMITS.mcpServers) throw new SetupError("setup.tooManyMcpServers", { max: SETUP_LIMITS.mcpServers });
  const totals = setupTotals(input);
  if (totals.files > SETUP_LIMITS.files) throw new SetupError("setup.tooManyFiles", { files: totals.files, max: SETUP_LIMITS.files });
  if (totals.bytes > SETUP_LIMITS.totalBytes) throw new SetupError("setup.tooBig", { mb: (totals.bytes / 1024 / 1024).toFixed(1), max: SETUP_LIMITS.totalBytes / 1024 / 1024 });
  return totals;
}

export function maskUrl(raw: string) {
  try {
    const url = new URL(raw);
    const keys = [...url.searchParams.keys()];
    if (!keys.length) return url.href;
    const query = keys.map((k) => `${encodeURIComponent(k)}=•••`).join("&");
    return `${url.origin}${url.pathname}?${query}`;
  } catch {
    return "•••";
  }
}
