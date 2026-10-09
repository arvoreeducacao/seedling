import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { domainAllowed, listedAdmin } from "@/lib/admins";
import { signupDecision, signupMethod } from "@/lib/signup";
import { INVITE_HEADER, consumeInvite, hasUsers } from "@/lib/admin-invites";
import { mailConfigured, sendVerification } from "@/lib/mail";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

function socialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};
  if (env.google.clientId && env.google.clientSecret) providers.google = env.google;
  if (env.github.clientId && env.github.clientSecret) providers.github = env.github;
  return providers;
}

export const auth = betterAuth({
  baseURL: env.url,
  secret: env.authSecret || undefined,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { user: schema.authUser, session: schema.authSession, account: schema.authAccount, verification: schema.authVerification },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, requireEmailVerification: mailConfigured() },
  emailVerification: mailConfigured()
    ? {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
          await sendVerification({ to: user.email, url });
        },
      }
    : undefined,
  account: { accountLinking: { enabled: true, trustedProviders: ["github", "google"], requireLocalEmailVerified: mailConfigured() } },
  socialProviders: socialProviders(),
  session: { expiresIn: 60 * 60 * 24 * 7 },
  advanced: { cookiePrefix: "seedling", useSecureCookies: env.secureCookies },
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          const email = String(user.email ?? "").trim().toLowerCase();
          const method = signupMethod(ctx?.path);
          const inviteToken = ctx?.headers?.get(INVITE_HEADER) ?? null;
          const invite = method === "password" && inviteToken ? await consumeInvite(inviteToken, email) : false;
          const decision = signupDecision({
            method,
            domainOk: domainAllowed(email),
            listed: await listedAdmin(email),
            envListed: env.adminEmails.includes(email),
            noUsers: !(await hasUsers()),
            smtp: mailConfigured(),
            providerVerified: Boolean(user.emailVerified),
            invite,
          });
          if (!decision.ok) {
            throw new APIError("FORBIDDEN", { code: "SIGNUP_CLOSED", message: "This workspace is invite-only. Ask an admin for an invite link." });
          }
          return { data: { ...user, emailVerified: Boolean(user.emailVerified) || decision.verified } };
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export function enabledProviders() {
  return { google: Boolean(env.google.clientId && env.google.clientSecret), github: Boolean(env.github.clientId && env.github.clientSecret) };
}

export async function emailFromHeaders(headers: Headers) {
  const result = await auth.api.getSession({ headers }).catch(() => null);
  if (!result) return null;
  return { email: result.user.email.toLowerCase(), name: result.user.name || null };
}
