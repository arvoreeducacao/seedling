import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const admins = sqliteTable("admins", {
  email: text("email").primaryKey(),
  name: text("name"),
  addedBy: text("added_by"),
  createdAt: createdAt(),
});

export const accessRequests = sqliteTable("access_requests", {
  id: id(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: createdAt(),
});

export const adminSessions = sqliteTable("admin_sessions", {
  id: id(),
  email: text("email").notNull(),
  name: text("name"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
});

export const challenges = sqliteTable("challenges", {
  id: id(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  level: text("level", { enum: ["junior", "pleno", "senior"] }).notNull(),
  kind: text("kind", { enum: ["code", "screen"] }).notNull().default("code"),
  minutes: integer("minutes").notNull().default(30),
  runtime: text("runtime").notNull().default("node"),
  statement: text("statement").notNull().default(""),
  rubric: text("rubric"),
  visibleTestCommand: text("visible_test_command"),
  hiddenTestCommand: text("hidden_test_command"),
  previewCommand: text("preview_command"),
  previewPort: integer("preview_port"),
  traps: text("traps", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  flow: text("flow", { mode: "json" }).$type<{ title: string; description?: string }[]>().notNull().default(sql`'[]'`),
  states: text("states", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  fileCounts: text("file_counts", { mode: "json" })
    .$type<{ visible: number; hidden: number; reference: number; team: number }>()
    .notNull()
    .default(sql`'{"visible":0,"hidden":0,"reference":0,"team":0}'`),
  checks: text("checks", { mode: "json" }).$type<ChallengeCheck[]>().notNull().default(sql`'[]'`),
  status: text("status", { enum: ["draft", "checking", "published", "error"] }).notNull().default("draft"),
  createdBy: text("created_by"),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export type ChallengeCheck = {
  key: "reference-passes" | "starter-fails" | "no-secrets" | "statement-leak";
  ok: boolean;
  title: string;
  detail: string;
};

export const challengeFiles = sqliteTable(
  "challenge_files",
  {
    id: id(),
    challengeId: text("challenge_id").notNull(),
    path: text("path").notNull(),
    role: text("role", { enum: ["statement", "visible", "visible-test", "hidden", "reference", "team"] }).notNull(),
    size: integer("size").notNull(),
  },
  (t) => [uniqueIndex("challenge_files_path").on(t.challengeId, t.path)],
);

export const jobs = sqliteTable("jobs", {
  id: id(),
  name: text("name").notNull(),
  color: text("color").notNull().default("cand"),
  challengeIds: text("challenge_ids", { mode: "json" }).$type<string[]>().notNull(),
  minutes: integer("minutes").notNull(),
  budgetUsd: real("budget_usd").notNull().default(5),
  model: text("model").notNull().default("claude-sonnet-5-5"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const sessions = sqliteTable("sessions", {
  id: id(),
  jobId: text("job_id"),
  candidateEmail: text("candidate_email").notNull(),
  candidateName: text("candidate_name"),
  mode: text("mode", { enum: ["live", "async"] }).notNull().default("live"),
  inviteTokenHash: text("invite_token_hash").notNull(),
  inviteExpiresAt: integer("invite_expires_at", { mode: "timestamp_ms" }).notNull(),
  candidateCookieHash: text("candidate_cookie_hash"),
  challengeIds: text("challenge_ids", { mode: "json" }).$type<string[]>().notNull(),
  currentIndex: integer("current_index").notNull().default(0),
  minutes: integer("minutes").notNull(),
  extraMinutes: integer("extra_minutes").notNull().default(0),
  budgetUsd: real("budget_usd").notNull(),
  model: text("model").notNull(),
  status: text("status", {
    enum: ["invited", "running", "paused", "submitted", "expired", "cancelled"],
  })
    .notNull()
    .default("invited"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  pausedAt: integer("paused_at", { mode: "timestamp_ms" }),
  pausedMs: integer("paused_ms").notNull().default(0),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  decision: text("decision", { enum: ["advance", "talk", "reject"] }),
  decidedBy: text("decided_by"),
  defenseQuestions: text("defense_questions", { mode: "json" }).$type<string[]>(),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
  practiceOf: text("practice_of"),
  createdBy: text("created_by"),
  createdAt: createdAt(),
});

export const passes = sqliteTable("passes", {
  id: id(),
  sessionId: text("session_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  budgetUsd: real("budget_usd").notNull(),
  spentUsd: real("spent_usd").notNull().default(0),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  revokedReason: text("revoked_reason"),
  createdAt: createdAt(),
});

export const attempts = sqliteTable("attempts", {
  id: id(),
  sessionId: text("session_id").notNull(),
  challengeId: text("challenge_id").notNull(),
  index: integer("index").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
  hiddenPassed: integer("hidden_passed"),
  hiddenTotal: integer("hidden_total"),
  hiddenOutput: text("hidden_output"),
  statesDone: text("states_done", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
});

export const aiCalls = sqliteTable("ai_calls", {
  id: id(),
  sessionId: text("session_id").notNull(),
  source: text("source", { enum: ["panel", "terminal"] }).notNull(),
  model: text("model").notNull(),
  prompt: text("prompt"),
  response: text("response"),
  toolUses: text("tool_uses", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  status: integer("status").notNull(),
  agentKey: text("agent_key").notNull().default("main"),
  createdAt: createdAt(),
});

export const agents = sqliteTable("agents", {
  id: id(),
  sessionId: text("session_id").notNull(),
  challengeIndex: integer("challenge_index").notNull(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  closedAt: integer("closed_at", { mode: "timestamp_ms" }),
  mergedAt: integer("merged_at", { mode: "timestamp_ms" }),
});

export const events = sqliteTable("events", {
  id: id(),
  sessionId: text("session_id").notNull(),
  kind: text("kind", {
    enum: ["start", "file-open", "file-save", "paste", "apply-ai", "test-run", "submit", "note", "extend", "revoke", "message", "pause", "resume", "browse", "agent-open", "agent-close", "agent-merge", "agent-rename"],
  }).notNull(),
  actor: text("actor").notNull(),
  data: text("data", { mode: "json" }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
  createdAt: createdAt(),
});

export const evaluations = sqliteTable(
  "evaluations",
  {
    id: id(),
    sessionId: text("session_id").notNull(),
    evaluator: text("evaluator").notNull(),
    scores: text("scores", { mode: "json" }).$type<Record<string, number>>().notNull(),
    trapsFound: text("traps_found", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    comment: text("comment"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("evaluations_unique").on(t.sessionId, t.evaluator)],
);

export const auditLog = sqliteTable("audit_log", {
  id: id(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  ip: text("ip"),
  createdAt: createdAt(),
});

export const authUser = sqliteTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const authSession = sqliteTable("auth_session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
});

export const authAccount = sqliteTable("auth_account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const authVerification = sqliteTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export const adminInvites = sqliteTable("admin_invites", {
  id: id(),
  email: text("email"),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  usedBy: text("used_by"),
  createdBy: text("created_by").notNull(),
  createdAt: createdAt(),
});

export type SetupSkillFile = { path: string; content: string };
export type SetupSkill = { name: string; files: SetupSkillFile[] };
export type SetupMcpServer = { name: string; type: "http" | "sse"; url: string; headers: Record<string, string> };
export type SetupInstall = { at: string; skills: string[]; claudeMd: boolean; mcpServers: string[]; error?: string };

export const candidateSetups = sqliteTable("candidate_setups", {
  sessionId: text("session_id").primaryKey(),
  skills: text("skills", { mode: "json" }).$type<SetupSkill[]>().notNull().default(sql`'[]'`),
  claudeMd: text("claude_md"),
  mcpServers: text("mcp_servers", { mode: "json" }).$type<SetupMcpServer[]>().notNull().default(sql`'[]'`),
  lastInstall: text("last_install", { mode: "json" }).$type<SetupInstall>(),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export const prepKits = sqliteTable("prep_kits", {
  id: id(),
  kit: text("kit", { mode: "json" }).$type<import("@/lib/prep/kit").Kit>().notNull(),
  updatedBy: text("updated_by"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const prepProgress = sqliteTable("prep_progress", {
  sessionId: text("session_id").primaryKey(),
  openedAt: integer("opened_at", { mode: "timestamp_ms" }),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
  sectionsDone: text("sections_done", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  stepsDone: text("steps_done", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  practiceSessionId: text("practice_session_id"),
  practiceToken: text("practice_token"),
});
