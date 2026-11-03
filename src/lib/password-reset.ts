import { eq } from "drizzle-orm";
import { auth } from "@/lib/better-auth";
import { db, ready, schema } from "@/lib/db";
import { newToken } from "@/lib/crypto";
import { env } from "@/lib/env";

export const RESET_HOURS = 24;

const identifier = (token: string) => `reset-password:${token}`;

export function resetLink(token: string) {
  return `${env.url}/login?reset=${encodeURIComponent(token)}`;
}

export async function createPasswordReset(email: string, ttlMs = RESET_HOURS * 3_600_000) {
  await ready();
  const user = await db.query.authUser.findFirst({ where: eq(schema.authUser.email, email.trim().toLowerCase()), columns: { id: true } });
  if (!user) return null;
  const token = newToken("pwd");
  const ctx = await auth.$context;
  await ctx.internalAdapter.createVerificationValue({ identifier: identifier(token), value: user.id, expiresAt: new Date(Date.now() + ttlMs) });
  return { token, url: resetLink(token) };
}

export async function findPasswordReset(token: string | null | undefined) {
  if (!token) return null;
  await ready();
  const ctx = await auth.$context;
  const row = await ctx.internalAdapter.findVerificationValue(identifier(token));
  if (!row || row.expiresAt < new Date()) return null;
  const user = await db.query.authUser.findFirst({ where: eq(schema.authUser.id, row.value), columns: { email: true } });
  return user ? { email: user.email } : null;
}
