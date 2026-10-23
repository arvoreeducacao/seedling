import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seedling-sessions-"));
process.env.SEEDLING_DATA_DIR = dir;
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;

const started: string[] = [];
vi.mock("@/lib/sandbox", () => ({
  sandbox: () => ({
    running: async () => 0,
    start: async ({ sessionId }: { sessionId: string }) => {
      await new Promise((r) => setTimeout(r, 20));
      started.push(sessionId);
      return `container-${started.length}`;
    },
    exec: async () => ({ exitCode: 0, output: "" }),
  }),
}));
vi.mock("@/lib/challenges/store", async (original) => ({ ...(await original<typeof import("@/lib/challenges/store")>()), copyForCandidate: async () => {} }));
vi.mock("@/lib/agents", async (original) => ({ ...(await original<typeof import("@/lib/agents")>()), ensureRepo: async () => {} }));

let sessions: typeof import("./sessions");
let dbm: typeof import("./db");

beforeAll(async () => {
  dbm = await import("./db");
  await dbm.ready();
  sessions = await import("./sessions");
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("startSession", () => {
  it("starts once when the candidate presses Start twice at the same time", async () => {
    const { newId } = await import("./crypto");
    const id = newId();
    await dbm.db.insert(dbm.schema.sessions).values({ id, candidateEmail: "c@example.com", inviteTokenHash: newId(), inviteExpiresAt: new Date(Date.now() + 86_400_000), challengeIds: [], minutes: 60, budgetUsd: 5, model: "claude-sonnet-5-5", status: "invited" });
    const session = (await dbm.db.query.sessions.findFirst({ where: (s, { eq }) => eq(s.id, id) }))!;
    const results = await Promise.allSettled([sessions.startSession(session), sessions.startSession(session)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason.key).toBe("server.alreadyStarted");
    const passes = await dbm.db.query.passes.findMany({ where: (p, { eq }) => eq(p.sessionId, id) });
    expect(passes).toHaveLength(1);
    expect(started.filter((s) => s === id)).toHaveLength(1);
  });
});
