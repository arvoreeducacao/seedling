import AdmZip from "adm-zip";
import type { SetupSkill } from "@/lib/db/schema";
import { SETUP_LIMITS, SetupError, checkSkill, cleanRelativePath, decodeText, frontmatterName, printable, skillNameFrom } from "./validate";

const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;
const S_IFREG = 0o100000;
const ENCRYPTED = 0x1;

function ignored(path: string) {
  const parts = path.split("/");
  const base = parts[parts.length - 1];
  return parts[0] === "__MACOSX" || base === ".DS_Store" || base === "Thumbs.db" || base.startsWith("._");
}

const SKIPPED_DIRS = new Set(["node_modules", "__pycache__"]);

function hiddenPart(path: string) {
  const parts = path.split("/");
  const at = parts.findIndex((p) => (p.startsWith(".") && p !== "." && p !== "..") || SKIPPED_DIRS.has(p));
  if (at < 0) return null;
  return at === parts.length - 1 ? path : `${parts.slice(0, at + 1).join("/")}/`;
}

function isSymlink(attr: number) {
  const mode = (attr >>> 16) & S_IFMT;
  return mode === S_IFLNK;
}

function isOddType(attr: number) {
  const mode = (attr >>> 16) & S_IFMT;
  return mode !== 0 && mode !== S_IFREG && mode !== 0o040000;
}

export type SkipReason = "hidden" | "binary" | "tooBig" | "outside";
export type Skipped = { path: string; reason: SkipReason };
export type ZipResult = { skills: SetupSkill[]; skipped: Skipped[] };

export function readSkillZip(buffer: Buffer, archiveName = "skill"): ZipResult {
  if (buffer.length > SETUP_LIMITS.zipBytes) throw new SetupError("setup.zipTooBig", { mb: SETUP_LIMITS.zipBytes / 1024 / 1024 });
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new SetupError("setup.zipInvalid");
  }
  let entries: AdmZip.IZipEntry[];
  try {
    entries = zip.getEntries();
  } catch {
    throw new SetupError("setup.zipInvalid");
  }
  if (entries.length > SETUP_LIMITS.zipEntries) throw new SetupError("setup.zipTooManyEntries", { entries: entries.length, max: SETUP_LIMITS.zipEntries });
  const files: { path: string; content: string }[] = [];
  const skipped = new Map<string, SkipReason>();
  const isSkillMd = (path: string) => path === "SKILL.md" || path.endsWith("/SKILL.md");
  let declared = 0;
  for (const entry of entries) {
    const raw = entry.entryName.normalize("NFC");
    if (ignored(raw.replace(/\/$/, ""))) continue;
    const hidden = hiddenPart(raw.replace(/\/$/, ""));
    if (hidden) {
      if (!skipped.has(hidden)) skipped.set(hidden, "hidden");
      continue;
    }
    if (isSymlink(entry.attr)) throw new SetupError("setup.zipSymlink", { path: printable(raw) });
    if ((entry.header.flags & ENCRYPTED) !== 0) throw new SetupError("setup.zipEncrypted");
    const path = cleanRelativePath(raw);
    if (entry.isDirectory) continue;
    if (isOddType(entry.attr)) throw new SetupError("setup.zipOddFile", { path: printable(raw) });
    const size = entry.header.size;
    if (size > SETUP_LIMITS.fileBytes) {
      if (isSkillMd(path)) throw new SetupError("setup.fileTooBig", { path, kb: SETUP_LIMITS.fileBytes / 1024 });
      skipped.set(path, "tooBig");
      continue;
    }
    declared += size;
    if (declared > SETUP_LIMITS.totalBytes) throw new SetupError("setup.zipUnpacksTooBig", { mb: SETUP_LIMITS.totalBytes / 1024 / 1024 });
    if (files.length >= SETUP_LIMITS.files) throw new SetupError("setup.zipTooManyFiles", { max: SETUP_LIMITS.files });
    let data: Buffer;
    try {
      data = entry.getData();
    } catch {
      throw new SetupError("setup.zipUnreadable", { path });
    }
    if (data.length !== size || data.length > SETUP_LIMITS.fileBytes) throw new SetupError("setup.zipSizeMismatch", { path });
    let content: string;
    try {
      content = decodeText(data, `"${path}"`);
    } catch (error) {
      if (isSkillMd(path)) throw error;
      skipped.set(path, "binary");
      continue;
    }
    files.push({ path, content });
  }
  const roots = files
    .filter((f) => f.path === "SKILL.md" || f.path.endsWith("/SKILL.md"))
    .map((f) => f.path.slice(0, -"SKILL.md".length).replace(/\/$/, ""))
    .sort((a, b) => a.length - b.length);
  if (!roots.length) throw new SetupError("setup.zipNoSkillMd");
  for (const root of roots) {
    const parent = roots.find((other) => other !== root && (other === "" || root.startsWith(`${other}/`)));
    if (parent !== undefined) throw new SetupError("setup.zipNestedSkill", { path: root, parent: parent || archiveName });
  }
  const skills: SetupSkill[] = [];
  const used = new Set<string>();
  for (const root of roots) {
    const prefix = root ? `${root}/` : "";
    const own = files.filter((f) => f.path.startsWith(prefix)).map((f) => ({ path: f.path.slice(prefix.length), content: f.content }));
    const main = own.find((f) => f.path === "SKILL.md")!;
    const source = root ? root.split("/").pop()! : frontmatterName(main.content) ?? archiveName.replace(/\.zip$/i, "");
    const name = skillNameFrom(source);
    if (used.has(name)) throw new SetupError("setup.zipDuplicateSkill", { name });
    used.add(name);
    skills.push(checkSkill({ name, files: own }));
  }
  const covered = (path: string) => roots.some((root) => root === "" || path.startsWith(`${root}/`));
  for (const file of files) if (!covered(file.path)) skipped.set(file.path, "outside");
  return { skills, skipped: [...skipped].map(([path, reason]) => ({ path, reason })) };
}
