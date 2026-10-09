import { and, eq, gt, isNull } from "drizzle-orm";
import { db, ready, schema } from "@/lib/db";
import { hashToken, newId, newToken } from "@/lib/crypto";
import { env } from "@/lib/env";

export const INVITE_HEADER = "x-seedling-invite";
const INVITE_DAYS = 7;
const SETUP_HOURS = 24;

export function inviteLink(token: string) {
  return `${env.url}/login?invite=${encodeURIComponent(token)}`;
}

export async function hasUsers() {
  await ready();
  return Boolean(await db.query.authUser.findFirst({ columns: { id: true } }));
}

export async function createAdminInvite(email: string | null, createdBy: string, ttlMs = INVITE_DAYS * 86_400_000) {
  await ready();
  const token = newToken("adm");
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.insert(schema.adminInvites).values({ id: newId(), email: email?.trim().toLowerCase() ?? null, tokenHash: hashToken(token), expiresAt, createdBy });
  return { token, url: inviteLink(token), expiresAt };
}

export async function findInvite(token: string | null | undefined) {
  if (!token) return null;
  await ready();
  const row = await db.query.adminInvites.findFirst({
    where: and(eq(schema.adminInvites.tokenHash, hashToken(token)), isNull(schema.adminInvites.usedAt), gt(schema.adminInvites.expiresAt, new Date())),
  });
  if (!row) return null;
  if (row.email === null && (await hasUsers())) return null;
  return row;
}

export function inviteMatches(invite: { email: string | null } | null, email: string) {
  if (!invite) return false;
  return invite.email === null || invite.email === email.trim().toLowerCase();
}

export async function consumeInvite(token: string | null | undefined, email: string) {
  const invite = await findInvite(token);
  if (!invite || !inviteMatches(invite, email)) return false;
  const used = await db
    .update(schema.adminInvites)
    .set({ usedAt: new Date(), usedBy: email.trim().toLowerCase() })
    .where(and(eq(schema.adminInvites.id, invite.id), isNull(schema.adminInvites.usedAt)))
    .returning({ id: schema.adminInvites.id });
  return used.length === 1;
}

export async function announceBootstrap() {
  if (env.adminEmails.length || (await hasUsers())) return;
  const { url } = await createAdminInvite(null, "system", SETUP_HOURS * 3_600_000);
  console.log(`[seedling] no admin yet. Create the owner account within ${SETUP_HOURS}h at: ${url}`);
}
