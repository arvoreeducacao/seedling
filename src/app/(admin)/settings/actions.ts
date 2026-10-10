"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { audit, requireAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { createAdminInvite } from "@/lib/admin-invites";
import { domainAllowed } from "@/lib/admins";
import { getI18n } from "@/lib/i18n/server";

export type AdminInviteResult = { ok: true; email: string; url: string } | { ok: false; error: string };

export async function inviteAdmin(_prev: AdminInviteResult | null, formData: FormData): Promise<AdminInviteResult> {
  const admin = await requireAdmin();
  const { t } = await getI18n();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: t("settings.admins.badEmail") };
  if (!domainAllowed(email)) return { ok: false, error: t("settings.admins.badDomain") };
  await db.insert(schema.admins).values({ email, addedBy: admin.email }).onConflictDoNothing();
  await db.delete(schema.accessRequests).where(eq(schema.accessRequests.email, email));
  const { url } = await createAdminInvite(email, admin.email);
  await audit(admin.email, "settings.audit.inviteCreated", email);
  revalidatePath("/settings");
  return { ok: true, email, url };
}

export async function addAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  await db.insert(schema.admins).values({ email, addedBy: admin.email }).onConflictDoNothing();
  await db.delete(schema.accessRequests).where(eq(schema.accessRequests.email, email));
  await audit(admin.email, "settings.audit.adminAdded", email);
  revalidatePath("/settings");
}

export async function removeAdmin(email: string) {
  const admin = await requireAdmin();
  if (email === admin.email) return;
  await db.delete(schema.admins).where(eq(schema.admins.email, email));
  await audit(admin.email, "settings.audit.adminRemoved", email);
  revalidatePath("/settings");
}

export async function dismissRequest(id: string) {
  await requireAdmin();
  await db.delete(schema.accessRequests).where(eq(schema.accessRequests.id, id));
  revalidatePath("/settings");
}
