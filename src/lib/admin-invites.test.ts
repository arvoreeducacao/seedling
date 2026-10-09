import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seedling-invites-"));
process.env.SEEDLING_DATA_DIR = dir;
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;

let invites: typeof import("./admin-invites");
let dbm: typeof import("./db");

beforeAll(async () => {
  dbm = await import("./db");
  await dbm.ready();
  invites = await import("./admin-invites");
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("admin invite links", () => {
  it("lets the first owner in through a setup link only while there are no users", async () => {
    const setup = await invites.createAdminInvite(null, "system");
    expect(await invites.findInvite(setup.token)).not.toBeNull();
    await dbm.db.insert(dbm.schema.authUser).values({ id: "u1", name: "Owner", email: "owner@example.com", createdAt: new Date(), updatedAt: new Date() });
    expect(await invites.findInvite(setup.token)).toBeNull();
    expect(await invites.consumeInvite(setup.token, "anyone@example.com")).toBe(false);
  });

  it("works once, only for the invited email", async () => {
    const invite = await invites.createAdminInvite("Teammate@Example.com", "owner@example.com");
    expect(invite.url).toContain("/login?invite=");
    expect(await invites.consumeInvite(invite.token, "intruder@example.com")).toBe(false);
    expect(await invites.consumeInvite(invite.token, "teammate@example.com")).toBe(true);
    expect(await invites.consumeInvite(invite.token, "teammate@example.com")).toBe(false);
  });

  it("expires", async () => {
    const invite = await invites.createAdminInvite("late@example.com", "owner@example.com", -1);
    expect(await invites.consumeInvite(invite.token, "late@example.com")).toBe(false);
    expect(await invites.findInvite("adm_forged")).toBeNull();
  });
});
