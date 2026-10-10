import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { eq } from "drizzle-orm";
import { db, ready, schema } from "@/lib/db";
import { newId } from "@/lib/crypto";
import { dataPath } from "@/lib/env";
import { sandbox } from "@/lib/sandbox";
import { copyTreeNoLinks, makeTreeWritable } from "@/lib/safe-path";
import { AppError, type Key } from "@/lib/i18n";
import type { ChallengeCheck } from "@/lib/db/schema";
import {
  classify,
  findSecrets,
  hiddenDirOf,
  isIgnored,
  parseTestCounts,
  pickStatement,
  referenceTarget,
  statementLeaks,
  stripCommonRoot,
  trapsFrom,
  type FileRole,
  type SecretKind,
} from "./classify";

type Manifest = {
  title?: string;
  summary?: string;
  level?: "junior" | "mid" | "pleno" | "senior";
  kind?: "code" | "screen";
  minutes?: number;
  runtime?: string;
  test?: { visible?: string; hidden?: string };
  preview?: { command?: string; port?: number };
  flow?: { title: string; description?: string }[];
  states?: string[];
};

const MAX_FILES = 5000;
const MAX_BYTES = 50 * 1024 * 1024;

const secretKeys: Record<SecretKind, Key> = {
  env: "challenges.secret.env",
  anthropic: "challenges.secret.anthropic",
  openai: "challenges.secret.openai",
  aws: "challenges.secret.aws",
  github: "challenges.secret.github",
  privateKey: "challenges.secret.privateKey",
  slack: "challenges.secret.slack",
};

export function challengeDir(id: string) {
  return dataPath("challenges", id, "files");
}

function safeJoin(root: string, relative: string) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error(`invalid path: ${relative}`);
  return target;
}

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function isText(buffer: Buffer) {
  return !buffer.subarray(0, 8000).includes(0);
}

function inferRuntime(paths: string[], manifest: Manifest) {
  if (manifest.runtime) return manifest.runtime;
  if (paths.includes("package.json")) return "node";
  if (paths.some((p) => p.endsWith(".py")) || paths.includes("requirements.txt")) return "python";
  return "node";
}

function inferCommands(runtime: string, hiddenDir: string | null, pkg: { scripts?: Record<string, string> } | null, manifest: Manifest) {
  const visible =
    manifest.test?.visible ??
    (runtime === "python" ? "python3 -m pytest -q" : pkg?.scripts?.test ? "npm test --silent" : "node --test");
  const hidden =
    manifest.test?.hidden ??
    (hiddenDir ? (runtime === "python" ? `python3 -m pytest -q ${hiddenDir}` : `node --test "${hiddenDir}/**/*.test.js"`) : null);
  return { visible, hidden };
}

export async function importZip(buffer: Buffer, createdBy: string) {
  await ready();
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter((e) => !e.isDirectory && !isIgnored(e.entryName));
  if (!entries.length) throw new AppError("challenges.zipEmpty");
  if (entries.length > MAX_FILES) throw new AppError("challenges.zipTooManyFiles", { max: MAX_FILES });
  const total = entries.reduce((sum, e) => sum + e.header.size, 0);
  if (total > MAX_BYTES) throw new AppError("challenges.zipTooBig");

  const renamed = stripCommonRoot(entries.map((e) => e.entryName));
  const files = entries.map((entry, i) => ({ path: renamed[i].to, data: entry.getData() }));
  const paths = files.map((f) => f.path);
  const read = (p: string) => {
    const f = files.find((x) => x.path === p);
    return f ? f.data.toString("utf8") : null;
  };

  const manifest: Manifest = JSON.parse(read("seedling.json") ?? "{}");
  const statementPath = pickStatement(paths);
  const statement = statementPath ? (read(statementPath) ?? "") : "";
  const rubricPath = paths.find((p) => /^(rubrica|rubric)\.md$/i.test(p)) ?? null;
  const rubric = rubricPath ? read(rubricPath) : null;
  const runtime = inferRuntime(paths, manifest);
  const hiddenDir = hiddenDirOf(paths);
  const pkg = JSON.parse(read("package.json") ?? "null");
  const commands = inferCommands(runtime, hiddenDir, pkg, manifest);
  const title = manifest.title ?? statement.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
  const roles = files.map((f) => ({ ...f, role: classify(f.path, statementPath) as FileRole }));
  const counts = {
    visible: roles.filter((r) => r.role === "visible" || r.role === "visible-test" || r.role === "statement").length,
    hidden: roles.filter((r) => r.role === "hidden").length,
    reference: roles.filter((r) => r.role === "reference").length,
    team: roles.filter((r) => r.role === "team").length,
  };

  const id = newId();
  const root = challengeDir(id);
  for (const file of roles) {
    const target = safeJoin(root, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.data);
  }

  await db.insert(schema.challenges).values({
    id,
    slug: slugify(title),
    title,
    summary: manifest.summary ?? statement.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.slice(0, 200) ?? null,
    level: !manifest.level || manifest.level === "mid" ? "pleno" : manifest.level,
    kind: manifest.kind ?? (manifest.preview ? "screen" : "code"),
    minutes: manifest.minutes ?? 30,
    runtime,
    statement,
    rubric,
    visibleTestCommand: commands.visible,
    hiddenTestCommand: commands.hidden,
    previewCommand: manifest.preview?.command ?? null,
    previewPort: manifest.preview?.port ?? null,
    traps: trapsFrom(rubric),
    flow: manifest.flow ?? [],
    states: manifest.states ?? [],
    fileCounts: counts,
    status: "draft",
    createdBy,
  });
  await db.insert(schema.challengeFiles).values(
    roles.map((r) => ({ id: newId(), challengeId: id, path: r.path, role: r.role, size: r.data.length })),
  );

  return id;
}

export async function listFiles(challengeId: string) {
  return db.query.challengeFiles.findMany({ where: eq(schema.challengeFiles.challengeId, challengeId) });
}

export async function copyForCandidate(challengeId: string, target: string, include: FileRole[] = ["statement", "visible", "visible-test"]) {
  const files = await listFiles(challengeId);
  const root = challengeDir(challengeId);
  await fs.mkdir(target, { recursive: true });
  for (const file of files.filter((f) => include.includes(f.role))) {
    const dest = safeJoin(target, file.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(safeJoin(root, file.path), dest);
  }
}

export async function overlay(challengeId: string, target: string, role: "hidden" | "reference") {
  const files = (await listFiles(challengeId)).filter((f) => f.role === role);
  const root = challengeDir(challengeId);
  for (const file of files) {
    const destPath = role === "reference" ? referenceTarget(file.path) : file.path;
    const dest = safeJoin(target, destPath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(safeJoin(root, file.path), dest);
  }
}

async function scratch(label: string) {
  const dir = dataPath("scratch", `${label}-${newId()}`);
  await fs.mkdir(dir, { recursive: true });
  await fs.chmod(dir, 0o777);
  return dir;
}

export async function runHidden(challengeId: string, workspace: string) {
  const challenge = await db.query.challenges.findFirst({ where: eq(schema.challenges.id, challengeId) });
  if (!challenge?.hiddenTestCommand) return null;
  const dir = await scratch("grade");
  try {
    await copyTreeNoLinks(workspace, dir);
    await overlay(challengeId, dir, "hidden");
    await makeTreeWritable(dir);
    const result = await sandbox().runIsolated(dir, challenge.hiddenTestCommand, 180_000);
    return { ...parseTestCounts(result.output, result.exitCode), ...result };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function staticChecksFor(challengeId: string, statement: string): Promise<ChallengeCheck[]> {
  const files = await listFiles(challengeId);
  const root = challengeDir(challengeId);
  const texts: { path: string; content: string }[] = [];
  for (const f of files) {
    const buffer = await fs.readFile(safeJoin(root, f.path)).catch(() => null);
    if (buffer && isText(buffer)) texts.push({ path: f.path, content: buffer.toString("utf8") });
  }
  const secrets = findSecrets(texts);
  const leaks = statementLeaks(
    statement,
    files.filter((f) => f.role === "hidden" || f.role === "reference" || f.role === "team").map((f) => f.path),
    files.filter((f) => f.role === "visible" || f.role === "visible-test" || f.role === "statement").map((f) => f.path),
  );
  return [
    secrets.length
      ? {
          key: "no-secrets",
          ok: false,
          titleMessage: { key: "challenges.check.noSecretsFail" },
          detailFindings: secrets.slice(0, 5).map((secret) => ({ key: secretKeys[secret.kind], params: { path: secret.path } })),
        }
      : {
          key: "no-secrets",
          ok: true,
          titleMessage: { key: "challenges.check.noSecretsOk" },
          detailMessage: { key: "challenges.check.noSecretsOkDetail" },
        },
    leaks.length
      ? {
          key: "statement-leak",
          ok: false,
          titleMessage: { key: "challenges.check.leakFail" },
          detailFindings: leaks.slice(0, 3).map((leak) => ({ key: "challenges.leak", params: { line: leak.line, path: leak.path } })),
        }
      : {
          key: "statement-leak",
          ok: true,
          titleMessage: { key: "challenges.check.leakOk" },
          detailMessage: { key: "challenges.check.leakOkDetail" },
        },
  ];
}

export async function runChecks(challengeId: string) {
  const challenge = await db.query.challenges.findFirst({ where: eq(schema.challenges.id, challengeId) });
  if (!challenge) return;
  await db.update(schema.challenges).set({ status: "checking" }).where(eq(schema.challenges.id, challengeId));
  const staticChecks = await staticChecksFor(challengeId, challenge.statement);
  const dynamic: ChallengeCheck[] = [];
  try {
    if (!challenge.hiddenTestCommand) {
      dynamic.push({
        key: "reference-passes",
        ok: false,
        titleMessage: { key: "challenges.noHiddenTests" },
        detailMessage: { key: "challenges.check.noHiddenTestsDetail" },
      });
    } else {
      await sandbox().ensureImage();
      const starter = await scratch("starter");
      await copyForCandidate(challengeId, starter);
      const starterResult = await runHidden(challengeId, starter);
      await fs.rm(starter, { recursive: true, force: true });
      const files = await listFiles(challengeId);
      if (files.some((f) => f.role === "reference")) {
        const ref = await scratch("reference");
        await copyForCandidate(challengeId, ref);
        await overlay(challengeId, ref, "reference");
        const refResult = await runHidden(challengeId, ref);
        await fs.rm(ref, { recursive: true, force: true });
        const allPass = Boolean(refResult && refResult.exitCode === 0 && refResult.passed === refResult.total);
        dynamic.push({
          key: "reference-passes",
          ok: allPass,
          titleMessage: { key: allPass ? "challenges.check.referenceOk" : "challenges.check.referenceFail" },
          detailMessage: refResult
            ? { key: "challenges.check.hiddenRatio", params: { passed: refResult.passed, n: refResult.total } }
            : { key: "challenges.check.didNotRun" },
        });
      } else {
        dynamic.push({
          key: "reference-passes",
          ok: true,
          titleMessage: { key: "challenges.check.noReference" },
          detailMessage: { key: "challenges.check.noReferenceDetail" },
        });
      }
      const starterSolved = Boolean(starterResult && starterResult.exitCode === 0 && starterResult.passed === starterResult.total);
      dynamic.push({
        key: "starter-fails",
        ok: !starterSolved,
        titleMessage: { key: starterSolved ? "challenges.check.starterSolved" : "challenges.check.starterFails" },
        detailMessage: starterResult
          ? { key: "challenges.check.hiddenRatioPass", params: { passed: starterResult.passed, n: starterResult.total } }
          : { key: "challenges.check.didNotRun" },
      });
    }
  } catch (error) {
    dynamic.push({
      key: "reference-passes",
      ok: false,
      titleMessage: { key: "challenges.check.runFailed" },
      detail: error instanceof Error ? error.message : undefined,
      detailMessage: error instanceof Error ? undefined : { key: "challenges.check.unknownError" },
    });
  }
  const checks = [...dynamic, ...staticChecks];
  const blocking = checks.some((c) => !c.ok && c.key !== "statement-leak");
  await db
    .update(schema.challenges)
    .set({ checks, status: blocking ? "error" : "draft", updatedAt: new Date() })
    .where(eq(schema.challenges.id, challengeId));
}
