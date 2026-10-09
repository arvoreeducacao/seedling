import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, ready, schema } from "@/lib/db";
import { newId } from "@/lib/crypto";
import { emailFromHeaders } from "@/lib/better-auth";
import { isAdminEmail } from "@/lib/admins";

export { isAdminEmail };

export type Admin = { email: string; name: string | null };

export async function currentUser() {
  await ready();
  return emailFromHeaders(await headers());
}

export async function currentAdmin(): Promise<Admin | null> {
  const user = await currentUser();
  if (!user) return null;
  if (!(await isAdminEmail(user.email))) return null;
  return user;
}

export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");
  return admin;
}

export async function audit(actor: string, action: string, target?: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await db.insert(schema.auditLog).values({ id: newId(), actor, action, target, ip });
}
