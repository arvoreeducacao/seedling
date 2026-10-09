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

function isSymlink(attr: number) {
  const mode = (attr >>> 16) & S_IFMT;
  return mode === S_IFLNK;
}

function isOddType(attr: number) {
  const mode = (attr >>> 16) & S_IFMT;
  return mode !== 0 && mode !== S_IFREG && mode !== 0o040000;
}

export type ZipResult = { skills: SetupSkill[]; ignored: string[] };

export function readSkillZip(buffer: Buffer, archiveName = "skill"): ZipResult {
  if (buffer.length > SETUP_LIMITS.totalBytes) throw new SetupError(`The zip is larger than ${SETUP_LIMITS.totalBytes / 1024 / 1024} MB.`);
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new SetupError("That file is not a valid zip.");
  }
  let entries: AdmZip.IZipEntry[];
  try {
    entries = zip.getEntries();
  } catch {
    throw new SetupError("That file is not a valid zip.");
  }
  if (entries.length > SETUP_LIMITS.zipEntries) throw new SetupError(`The zip has ${entries.length} entries. The limit is ${SETUP_LIMITS.zipEntries}.`);
  const files: { path: string; content: string }[] = [];
  let declared = 0;
  for (const entry of entries) {
    const raw = entry.entryName;
    if (ignored(raw.replace(/\/$/, ""))) continue;
    if (isSymlink(entry.attr)) throw new SetupError(`"${printable(raw)}" is a symlink. Zip the real files instead.`);
    if ((entry.header.flags & ENCRYPTED) !== 0) throw new SetupError("Password-protected zips are not supported.");
    const path = cleanRelativePath(raw);
    if (entry.isDirectory) continue;
    if (isOddType(entry.attr)) throw new SetupError(`"${printable(raw)}" is not a regular file.`);
    const size = entry.header.size;
    if (size > SETUP_LIMITS.fileBytes) throw new SetupError(`"${path}" is larger than ${SETUP_LIMITS.fileBytes / 1024} KB.`);
    declared += size;
    if (declared > SETUP_LIMITS.totalBytes) throw new SetupError(`The zip unpacks to more than ${SETUP_LIMITS.totalBytes / 1024 / 1024} MB.`);
    if (files.length >= SETUP_LIMITS.files) throw new SetupError(`The zip has more than ${SETUP_LIMITS.files} files.`);
    let data: Buffer;
    try {
      data = entry.getData();
    } catch {
      throw new SetupError(`"${path}" could not be read from the zip.`);
    }
    if (data.length !== size || data.length > SETUP_LIMITS.fileBytes) throw new SetupError(`"${path}" does not match its declared size.`);
    files.push({ path, content: decodeText(data, `"${path}"`) });
  }
  const roots = files
    .filter((f) => f.path === "SKILL.md" || f.path.endsWith("/SKILL.md"))
    .map((f) => f.path.slice(0, -"SKILL.md".length).replace(/\/$/, ""))
    .sort((a, b) => a.length - b.length);
  if (!roots.length) throw new SetupError("No SKILL.md found in the zip. Each skill is a folder with a SKILL.md inside.");
  for (const root of roots) {
    const parent = roots.find((other) => other !== root && (other === "" || root.startsWith(`${other}/`)));
    if (parent !== undefined) throw new SetupError(`"${root}" is a skill inside the skill "${parent || archiveName}". Keep skills side by side.`);
  }
  const skills: SetupSkill[] = [];
  const used = new Set<string>();
  for (const root of roots) {
    const prefix = root ? `${root}/` : "";
    const own = files.filter((f) => f.path.startsWith(prefix)).map((f) => ({ path: f.path.slice(prefix.length), content: f.content }));
    const main = own.find((f) => f.path === "SKILL.md")!;
    const source = root ? root.split("/").pop()! : frontmatterName(main.content) ?? archiveName.replace(/\.zip$/i, "");
    const name = skillNameFrom(source);
    if (used.has(name)) throw new SetupError(`Two skills in the zip are named "${name}".`);
    used.add(name);
    skills.push(checkSkill({ name, files: own }));
  }
  const covered = (path: string) => roots.some((root) => root === "" || path.startsWith(`${root}/`));
  return { skills, ignored: files.filter((f) => !covered(f.path)).map((f) => f.path) };
}
