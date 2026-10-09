import type { SetupMcpServer, SetupSkill, SetupSkillFile } from "@/lib/db/schema";

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

export class SetupError extends Error {}

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
  if (raw.includes("\0") || raw.includes("\\")) throw new SetupError(`"${printable(raw)}" is not a valid path.`);
  if (raw.startsWith("/") || /^[A-Za-z]:/.test(raw)) throw new SetupError(`"${printable(raw)}" is an absolute path.`);
  const parts = raw.split("/").filter((p) => p !== "" && p !== ".");
  if (!parts.length) throw new SetupError("Empty path.");
  for (const part of parts) {
    if (part === "..") throw new SetupError(`"${printable(raw)}" points outside the skill folder.`);
    if (!SEGMENT.test(part)) throw new SetupError(`"${printable(raw)}" has an unsupported name. Use letters, numbers, dot, dash and underscore.`);
  }
  if (parts.length > 8) throw new SetupError(`"${printable(raw)}" is nested too deep.`);
  return parts.join("/");
}

export function printable(text: string) {
  return text.replace(/[\u0000-\u001f\u007f]/g, "?").slice(0, 120);
}

export function decodeText(buffer: Buffer, label: string) {
  if (buffer.includes(0)) throw new SetupError(`${label} is not a text file.`);
  try {
    return utf8.decode(buffer);
  } catch {
    throw new SetupError(`${label} is not a UTF-8 text file.`);
  }
}

export function frontmatterName(skillMd: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd);
  if (!match) return null;
  const line = /^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(match[1]);
  return line ? line[1].trim() : null;
}

export function checkSkill(skill: SetupSkill): SetupSkill {
  if (!validSkillName(skill.name)) throw new SetupError(`"${printable(skill.name)}" is not a valid skill name. Use lowercase letters, numbers and dashes, up to 64 characters.`);
  if (!skill.files.length) throw new SetupError(`Skill "${skill.name}" has no files.`);
  const seen = new Set<string>();
  const files: SetupSkillFile[] = [];
  for (const file of skill.files) {
    const path = cleanRelativePath(file.path);
    if (seen.has(path)) throw new SetupError(`Skill "${skill.name}" has "${path}" twice.`);
    seen.add(path);
    if (byteLength(file.content) > SETUP_LIMITS.fileBytes) throw new SetupError(`"${skill.name}/${path}" is larger than ${SETUP_LIMITS.fileBytes / 1024} KB.`);
    if (file.content.includes("\0")) throw new SetupError(`"${skill.name}/${path}" is not a text file.`);
    files.push({ path, content: file.content });
  }
  const main = files.find((f) => f.path === "SKILL.md");
  if (!main) throw new SetupError(`Skill "${skill.name}" needs a SKILL.md at its root.`);
  if (!main.content.trim()) throw new SetupError(`The SKILL.md of "${skill.name}" is empty.`);
  files.sort((a, b) => Number(b.path === "SKILL.md") - Number(a.path === "SKILL.md") || a.path.localeCompare(b.path));
  return { name: skill.name, files };
}

export function pastedSkill(name: unknown, content: unknown): SetupSkill {
  if (typeof content !== "string" || !content.trim()) throw new SetupError("Paste the content of the SKILL.md.");
  const fromBody = frontmatterName(content);
  const raw = typeof name === "string" && name.trim() ? name.trim() : fromBody ?? "";
  if (!raw) throw new SetupError("Give the skill a name, or add a name: line to its frontmatter.");
  return checkSkill({ name: raw, files: [{ path: "SKILL.md", content }] });
}

export function checkClaudeMd(content: unknown) {
  if (typeof content !== "string") throw new SetupError("CLAUDE.md must be text.");
  if (content.includes("\0")) throw new SetupError("CLAUDE.md is not a text file.");
  if (byteLength(content) > SETUP_LIMITS.claudeMdBytes) throw new SetupError(`CLAUDE.md is larger than ${SETUP_LIMITS.claudeMdBytes / 1024} KB.`);
  return content.trim() ? content : null;
}

function checkUrl(raw: unknown, name: string) {
  if (typeof raw !== "string" || !raw.trim()) throw new SetupError(`MCP server "${name}" needs a url.`);
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new SetupError(`MCP server "${name}" has an invalid url.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SetupError(`MCP server "${name}" must use an http or https url.`);
  if (url.username || url.password) throw new SetupError(`MCP server "${name}" has credentials in the url. Move them to a header.`);
  if (url.href.length > 2048) throw new SetupError(`MCP server "${name}" has a url that is too long.`);
  return url.href;
}

function checkHeaders(raw: unknown, name: string) {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) throw new SetupError(`The headers of "${name}" must be an object.`);
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > SETUP_LIMITS.headers) throw new SetupError(`MCP server "${name}" has more than ${SETUP_LIMITS.headers} headers.`);
  const headers: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!HEADER_NAME.test(key)) throw new SetupError(`"${printable(key)}" is not a valid header name.`);
    if (typeof value !== "string") throw new SetupError(`The header ${key} of "${name}" must be text.`);
    if (/[\r\n\0]/.test(value)) throw new SetupError(`The header ${key} of "${name}" has a line break.`);
    if (byteLength(value) > SETUP_LIMITS.headerValueBytes) throw new SetupError(`The header ${key} of "${name}" is too long.`);
    headers[key] = value;
  }
  return headers;
}

export function checkMcpServer(name: string, raw: unknown): SetupMcpServer {
  if (!MCP_NAME.test(name)) throw new SetupError(`"${printable(name)}" is not a valid MCP server name. Use letters, numbers, dash and underscore.`);
  if (RESERVED_MCP_NAMES.has(name.toLowerCase())) throw new SetupError(`"${name}" is reserved for the sandbox browser. Pick another name.`);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new SetupError(`MCP server "${name}" must be an object.`);
  const config = raw as Record<string, unknown>;
  if ("command" in config || "args" in config || config.type === "stdio") throw new SetupError(`MCP server "${name}" runs a local command. Only remote servers (http or sse) are allowed.`);
  const type = config.type ?? config.transport ?? "http";
  if (type !== "http" && type !== "sse" && type !== "streamable-http") throw new SetupError(`MCP server "${name}" has type "${printable(String(type))}". Use http or sse.`);
  return { name, type: type === "sse" ? "sse" : "http", url: checkUrl(config.url, name), headers: checkHeaders(config.headers, name) };
}

export function parseMcpPaste(text: unknown): SetupMcpServer[] {
  if (typeof text !== "string" || !text.trim()) throw new SetupError("Paste a JSON with your MCP servers.");
  if (byteLength(text) > 64 * 1024) throw new SetupError("That MCP config is too large.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SetupError("That is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new SetupError("Expected a JSON object.");
  const root = parsed as Record<string, unknown>;
  const map = (root.mcpServers ?? root.servers ?? root) as unknown;
  if (!map || typeof map !== "object" || Array.isArray(map)) throw new SetupError("Expected an mcpServers object.");
  const entries = Object.entries(map as Record<string, unknown>);
  if (!entries.length) throw new SetupError("No MCP servers found in that JSON.");
  if ("url" in (map as object) || "type" in (map as object)) throw new SetupError('Wrap the server in a name, like {"mcpServers": {"my-server": {"type": "http", "url": "..."}}}.');
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
  if (input.skills.length > SETUP_LIMITS.skills) throw new SetupError(`You can bring up to ${SETUP_LIMITS.skills} skills.`);
  if (input.mcpServers.length > SETUP_LIMITS.mcpServers) throw new SetupError(`You can bring up to ${SETUP_LIMITS.mcpServers} MCP servers.`);
  const totals = setupTotals(input);
  if (totals.files > SETUP_LIMITS.files) throw new SetupError(`Your setup has ${totals.files} files. The limit is ${SETUP_LIMITS.files}.`);
  if (totals.bytes > SETUP_LIMITS.totalBytes) throw new SetupError(`Your setup is ${(totals.bytes / 1024 / 1024).toFixed(1)} MB. The limit is ${SETUP_LIMITS.totalBytes / 1024 / 1024} MB.`);
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
