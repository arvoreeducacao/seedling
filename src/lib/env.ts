import path from "node:path";
import { parseEffort } from "@/lib/budget";

const dataDir = path.resolve(process.env.SEEDLING_DATA_DIR ?? "./data");
const url = (process.env.SEEDLING_URL ?? "http://localhost:3100").replace(/\/$/, "");

const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function resolvePreviewOrigin(appUrl: string, configured: string | undefined) {
  const app = new URL(appUrl);
  let origin = "";
  if (configured?.trim()) {
    try {
      origin = new URL(configured.trim()).origin;
    } catch {
      return "";
    }
  } else if (loopback.has(app.hostname)) {
    const next = new URL(app.origin);
    next.port = String(Number(app.port || (app.protocol === "https:" ? 443 : 80)) + 1);
    origin = next.origin;
  }
  return origin && origin !== app.origin ? origin : "";
}

export function previewListenPort(previewOrigin: string, appPort: number, configured: string | undefined) {
  if (configured?.trim()) return Number(configured) || null;
  if (!previewOrigin) return null;
  const preview = new URL(previewOrigin);
  if (!loopback.has(preview.hostname)) return null;
  const port = Number(preview.port || (preview.protocol === "https:" ? 443 : 80));
  return port === appPort ? null : port;
}

function positive(value: string | undefined, fallback: number) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function list(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const env = {
  url,
  orgName: process.env.SEEDLING_ORG_NAME ?? "Seedling",
  dataDir,
  databaseUrl: process.env.DATABASE_URL ?? `file:${path.join(dataDir, "seedling.db")}`,
  adminEmails: list(process.env.SEEDLING_ADMIN_EMAILS),
  allowedDomains: list(process.env.SEEDLING_ALLOWED_EMAIL_DOMAINS),
  devLogin: process.env.SEEDLING_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production",
  secureCookies: url.startsWith("https://"),
  previewOrigin: resolvePreviewOrigin(url, process.env.SEEDLING_PREVIEW_ORIGIN),
  authSecret: process.env.BETTER_AUTH_SECRET ?? "",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID ?? "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  },
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicUpstream: (process.env.ANTHROPIC_UPSTREAM_URL ?? "https://api.anthropic.com").replace(/\/$/, ""),
  anthropicModelPrefix: process.env.ANTHROPIC_MODEL_PREFIX ?? "",
  monthlyBudgetUsd: Number(process.env.SEEDLING_MONTHLY_BUDGET_USD ?? 200),
  ai: {
    maxOutputTokens: positive(process.env.SEEDLING_AI_MAX_OUTPUT_TOKENS, 32_000),
    maxThinkingTokens: positive(process.env.SEEDLING_AI_MAX_THINKING_TOKENS, 16_000),
    maxEffort: parseEffort(process.env.SEEDLING_AI_MAX_EFFORT, "high"),
    maxInflight: positive(process.env.SEEDLING_AI_MAX_INFLIGHT, Math.max(4, 2 * positive(process.env.SEEDLING_MAX_AGENTS, 4))),
  },
  smtpUrl: process.env.SMTP_URL ?? "",
  mailFrom: process.env.SEEDLING_MAIL_FROM ?? "Seedling <no-reply@localhost>",
  sandbox: {
    driver: (process.env.SEEDLING_SANDBOX_DRIVER ?? "docker") as "docker" | "none",
    image: process.env.SEEDLING_SANDBOX_IMAGE ?? "seedling-sandbox:latest",
    gatewayUrl: (process.env.SEEDLING_SANDBOX_GATEWAY_URL ?? "http://host.docker.internal:3100").replace(/\/$/, ""),
    hostDataDir: process.env.SEEDLING_SANDBOX_HOST_DATA_DIR ?? dataDir,
    network: process.env.SEEDLING_SANDBOX_NETWORK ?? "",
    cpus: Number(process.env.SEEDLING_SANDBOX_CPUS ?? 1),
    memoryMb: Number(process.env.SEEDLING_SANDBOX_MEMORY_MB ?? 2048),
    pids: Number(process.env.SEEDLING_SANDBOX_PIDS ?? 1024),
    maxConcurrent: Number(process.env.SEEDLING_SANDBOX_MAX_CONCURRENT ?? 2),
    workspaceMaxMb: Number(process.env.SEEDLING_SANDBOX_WORKSPACE_MAX_MB ?? 200),
    maxAgents: Math.max(1, Number(process.env.SEEDLING_MAX_AGENTS ?? 4) || 4),
  },
};

export function dataPath(...parts: string[]) {
  return path.join(env.dataDir, ...parts);
}

export function hostDataPath(...parts: string[]) {
  return path.join(env.sandbox.hostDataDir, ...parts);
}
