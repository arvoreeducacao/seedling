"use server";

import fs from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { audit, requireAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { dataPath } from "@/lib/env";
import { runChecks } from "@/lib/challenges/store";

export async function updateChallenge(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const level = String(formData.get("level")) as "junior" | "pleno" | "senior";
  const kind = String(formData.get("kind")) as "code" | "screen";
  await db
    .update(schema.challenges)
    .set({
      title: String(formData.get("title") ?? "").trim(),
      level: ["junior", "pleno", "senior"].includes(level) ? level : "pleno",
      kind: kind === "screen" ? "screen" : "code",
      minutes: Math.max(5, Math.min(480, Number(formData.get("minutes") ?? 30))),
      visibleTestCommand: String(formData.get("visibleTestCommand") ?? "").trim() || null,
      hiddenTestCommand: String(formData.get("hiddenTestCommand") ?? "").trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.challenges.id, id));
  await audit(admin.email, "challenges.audit.edited", id);
  revalidatePath(`/challenges/${id}`);
}

export async function recheck(id: string) {
  await requireAdmin();
  await runChecks(id);
  revalidatePath(`/challenges/${id}`);
}

export async function publish(id: string) {
  const admin = await requireAdmin();
  const challenge = await db.query.challenges.findFirst({ where: eq(schema.challenges.id, id) });
  if (!challenge || challenge.status === "error" || challenge.status === "checking") return;
  await db.update(schema.challenges).set({ status: "published", updatedAt: new Date() }).where(eq(schema.challenges.id, id));
  await audit(admin.email, "challenges.audit.published", id);
  revalidatePath("/challenges");
  revalidatePath(`/challenges/${id}`);
}

export async function unpublish(id: string) {
  const admin = await requireAdmin();
  await db.update(schema.challenges).set({ status: "draft", updatedAt: new Date() }).where(eq(schema.challenges.id, id));
  await audit(admin.email, "challenges.audit.unpublished", id);
  revalidatePath(`/challenges/${id}`);
}

export async function removeChallenge(id: string) {
  const admin = await requireAdmin();
  await db.delete(schema.challengeFiles).where(eq(schema.challengeFiles.challengeId, id));
  await db.delete(schema.challenges).where(eq(schema.challenges.id, id));
  await fs.rm(dataPath("challenges", id), { recursive: true, force: true });
  await audit(admin.email, "challenges.audit.deleted", id);
  redirect("/challenges");
}
