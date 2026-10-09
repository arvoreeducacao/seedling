export type SignupMethod = "password" | "social" | "other";

export type SignupFacts = {
  method: SignupMethod;
  domainOk: boolean;
  listed: boolean;
  envListed: boolean;
  noUsers: boolean;
  smtp: boolean;
  providerVerified: boolean;
  invite: boolean;
};

export function signupDecision(facts: SignupFacts): { ok: boolean; verified: boolean } {
  if (!facts.domainOk) return { ok: false, verified: false };
  if (facts.invite) return { ok: true, verified: true };
  if (facts.method === "social") return { ok: facts.listed && facts.providerVerified, verified: facts.providerVerified };
  if (facts.method === "password") {
    if (facts.smtp) return { ok: facts.listed, verified: false };
    return { ok: facts.noUsers && facts.envListed, verified: false };
  }
  return { ok: facts.listed, verified: false };
}

export function signupMethod(path: string | undefined): SignupMethod {
  if (!path) return "other";
  if (path === "/sign-up/email") return "password";
  if (path.startsWith("/callback/") || path.startsWith("/oauth2/callback") || path === "/sign-in/social") return "social";
  return "other";
}
