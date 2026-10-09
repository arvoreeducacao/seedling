import { asc, eq } from "drizzle-orm";
import { db, ready, schema } from "@/lib/db";
import { env } from "@/lib/env";

function normalize(email: string) {
  return email.trim().toLowerCase();
}

export function domainAllowed(email: string) {
  return !env.allowedDomains.length || env.allowedDomains.includes(email.split("@")[1] ?? "");
}

export async function ownerEmail() {
  await ready();
  const first = await db.query.authUser.findFirst({ orderBy: asc(schema.authUser.createdAt) });
  return first ? normalize(first.email) : null;
}

export async function listedAdmin(email: string) {
  const normalized = normalize(email);
  if (env.adminEmails.includes(normalized)) return true;
  const row = await db.query.admins.findFirst({ where: eq(schema.admins.email, normalized) });
  return Boolean(row);
}

export async function isAdminEmail(email: string) {
  await ready();
  const normalized = normalize(email);
  if (!domainAllowed(normalized)) return false;
  if (await listedAdmin(normalized)) return true;
  return (await ownerEmail()) === normalized;
}
