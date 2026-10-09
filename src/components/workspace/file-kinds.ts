export type FileKind = "markdown" | "csv" | "tsv" | "json" | "image" | "svg" | "pdf" | "html" | "code";

const languages: Record<string, string> = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
  ts: "typescript", mts: "typescript", cts: "typescript", tsx: "typescript",
  py: "python", pyi: "python", rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin", kts: "kotlin", scala: "scala",
  c: "c", h: "c", cc: "cpp", cpp: "cpp", hpp: "cpp", cs: "csharp", php: "php", swift: "swift", dart: "dart", lua: "lua", r: "r", pl: "perl",
  ex: "elixir", exs: "elixir", clj: "clojure", fs: "fsharp",
  json: "json", jsonc: "json", json5: "json", map: "json",
  md: "markdown", markdown: "markdown", mdx: "markdown",
  css: "css", scss: "scss", sass: "scss", less: "less",
  html: "html", htm: "html", vue: "html", svelte: "html", hbs: "handlebars",
  xml: "xml", svg: "xml", plist: "xml",
  yml: "yaml", yaml: "yaml", toml: "ini", ini: "ini", cfg: "ini", conf: "ini", env: "ini", properties: "ini",
  sh: "shell", bash: "shell", zsh: "shell",
  sql: "sql", graphql: "graphql", gql: "graphql", proto: "protobuf",
  ps1: "powershell", bat: "bat",
};

const byName: Record<string, string> = { dockerfile: "dockerfile", makefile: "plaintext", ".env": "ini", ".gitignore": "plaintext", ".npmrc": "ini", ".editorconfig": "ini" };

function nameOf(path: string) {
  return (path.split("/").pop() ?? path).toLowerCase();
}

export function extensionOf(path: string) {
  const name = nameOf(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1) : "";
}

export function languageOf(path: string) {
  const name = nameOf(path);
  if (byName[name]) return byName[name];
  if (name.startsWith(".env")) return "ini";
  if (name.startsWith("dockerfile")) return "dockerfile";
  return languages[extensionOf(path)] ?? "plaintext";
}

export function kindOf(path: string): FileKind {
  const ext = extensionOf(path);
  if (ext === "md" || ext === "markdown" || ext === "mdx") return "markdown";
  if (ext === "csv") return "csv";
  if (ext === "tsv" || ext === "tab") return "tsv";
  if (ext === "json" || ext === "jsonc" || ext === "map" || ext === "webmanifest") return "json";
  if (ext === "svg") return "svg";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (ext === "html" || ext === "htm") return "html";
  return "code";
}

export function hasRenderedView(kind: FileKind) {
  return kind === "markdown" || kind === "csv" || kind === "tsv" || kind === "json" || kind === "svg";
}

export function isBinaryKind(kind: FileKind) {
  return kind === "image" || kind === "pdf";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseDelimited(text: string, delimiter: string, maxRows = Infinity) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  while (i < source.length) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (ch === "\r" && source[i + 1] === "\n") i++;
      i++;
      if (rows.length >= maxRows) return { rows, truncated: i < source.length };
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return { rows, truncated: false };
}

export function countLines(text: string) {
  let count = 0;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) count++;
  return text.length && text[text.length - 1] !== "\n" ? count + 1 : count;
}

export type TreeItem = { path: string; dir: boolean };

export function filterTree<T extends TreeItem>(entries: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  const keep = new Set<string>();
  for (const entry of entries) {
    if (entry.dir || !entry.path.toLowerCase().includes(q)) continue;
    keep.add(entry.path);
    const parts = entry.path.split("/");
    for (let i = 1; i < parts.length; i++) keep.add(parts.slice(0, i).join("/"));
  }
  return entries.filter((e) => keep.has(e.path));
}

export function resolveRelative(fromFile: string, href: string) {
  const clean = href.split(/[?#]/)[0];
  if (!clean) return null;
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {}
  const parts = decoded.startsWith("/") ? [] : fromFile.split("/").slice(0, -1);
  for (const segment of decoded.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(segment);
  }
  return parts.length ? parts.join("/") : null;
}

export function linkKind(href: string): "external" | "workspace" | "anchor" | "unsafe" {
  const value = href.trim();
  if (/^(https?:|mailto:)/i.test(value)) return "external";
  if (value.startsWith("#")) return "anchor";
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) return "unsafe";
  return "workspace";
}
