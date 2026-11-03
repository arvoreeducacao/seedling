import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seedling-reset-"));
process.env.SEEDLING_DATA_DIR = dir;
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.SEEDLING_ADMIN_EMAILS = "owner@example.com";

let reset: typeof import("./password-reset");
let ba: typeof import("./better-auth");

beforeAll(async () => {
  const dbm = await import("./db");
  await dbm.ready();
  ba = await import("./better-auth");
  reset = await import("./password-reset");
  await ba.auth.api.signUpEmail({ body: { email: "owner@example.com", password: "senha-antiga", name: "Owner" } });
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const signIn = (password: string) => ba.auth.api.signInEmail({ body: { email: "owner@example.com", password } }).then(() => true, () => false);

describe("new password links", () => {
  it("has nothing to reset for an email without an account", async () => {
    expect(await reset.createPasswordReset("ghost@example.com")).toBeNull();
  });

  it("lets the person set a new password once", async () => {
    const link = await reset.createPasswordReset("Owner@Example.com");
    expect(link?.url).toContain("/login?reset=");
    expect(await reset.findPasswordReset(link!.token)).toEqual({ email: "owner@example.com" });

    await ba.auth.api.resetPassword({ body: { token: link!.token, newPassword: "senha-nova-123" } });
    expect(await signIn("senha-nova-123")).toBe(true);
    expect(await signIn("senha-antiga")).toBe(false);

    expect(await reset.findPasswordReset(link!.token)).toBeNull();
    await expect(ba.auth.api.resetPassword({ body: { token: link!.token, newPassword: "outra-senha-123" } })).rejects.toThrow();
  });

  it("expires", async () => {
    const link = await reset.createPasswordReset("owner@example.com", -1000);
    expect(await reset.findPasswordReset(link!.token)).toBeNull();
  });
});
