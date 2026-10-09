import { describe, expect, it } from "vitest";
import { signupDecision, signupMethod, type SignupFacts } from "./signup";

const base: SignupFacts = { method: "password", domainOk: true, listed: true, envListed: true, noUsers: false, smtp: false, providerVerified: false, invite: false };

describe("who can create an interviewer account", () => {
  it("without email, refuses a password signup for a listed admin email that has no invite", () => {
    expect(signupDecision(base).ok).toBe(false);
    expect(signupDecision({ ...base, envListed: false }).ok).toBe(false);
  });

  it("without email, lets the first env-listed owner bootstrap the workspace", () => {
    expect(signupDecision({ ...base, noUsers: true })).toEqual({ ok: true, verified: false });
    expect(signupDecision({ ...base, noUsers: true, envListed: false, listed: false }).ok).toBe(false);
  });

  it("accepts a one-time invite link and marks the email as vouched for", () => {
    expect(signupDecision({ ...base, invite: true })).toEqual({ ok: true, verified: true });
    expect(signupDecision({ ...base, invite: true, domainOk: false }).ok).toBe(false);
  });

  it("with email configured, lets listed admins sign up but leaves them unverified", () => {
    expect(signupDecision({ ...base, smtp: true })).toEqual({ ok: true, verified: false });
    expect(signupDecision({ ...base, smtp: true, listed: false }).ok).toBe(false);
  });

  it("requires a verified email from Google or GitHub", () => {
    expect(signupDecision({ ...base, method: "social" }).ok).toBe(false);
    expect(signupDecision({ ...base, method: "social", providerVerified: true }).ok).toBe(true);
    expect(signupDecision({ ...base, method: "social", providerVerified: true, listed: false }).ok).toBe(false);
  });

  it("tells password and social signups apart", () => {
    expect(signupMethod("/sign-up/email")).toBe("password");
    expect(signupMethod("/callback/google")).toBe("social");
    expect(signupMethod("/sign-in/social")).toBe("social");
    expect(signupMethod(undefined)).toBe("other");
  });
});
