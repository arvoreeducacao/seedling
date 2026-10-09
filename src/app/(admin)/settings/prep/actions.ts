"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveKit } from "@/lib/prep";
import { defaultKit, parseKit, type Kit } from "@/lib/prep/kit";

export type KitResult = { ok: true; kit: Kit; notes: string[]; message: string } | { ok: false; error: string };

const MAX_IMPORT = 256 * 1024;

async function challengeRefs() {
  return db.query.challenges.findMany({ columns: { id: true, slug: true, status: true } });
}

async function store(input: unknown, admin: string, action: string, message: string): Promise<KitResult> {
  const parsed = parseKit(input, await challengeRefs());
  if (!parsed.ok) return { ok: false, error: parsed.error };
  await saveKit(parsed.kit, admin);
  await audit(admin, action, parsed.kit.name || "prep kit");
  revalidatePath("/settings");
  revalidatePath("/settings/prep");
  return { ok: true, kit: parsed.kit, notes: parsed.notes, message };
}

export async function saveKitAction(json: string): Promise<KitResult> {
  const admin = await requireAdmin();
  if (json.length > MAX_IMPORT) return { ok: false, error: "The kit is too large." };
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    return { ok: false, error: "Invalid kit." };
  }
  return store(input, admin.email, "updated the prep kit", "Saved. New and existing invites see it right away.");
}

export async function importKitAction(_prev: KitResult | null, formData: FormData): Promise<KitResult> {
  const admin = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose a .json file to import." };
  if (file.size > MAX_IMPORT) return { ok: false, error: "That file is larger than 256 KB." };
  let input: unknown;
  try {
    input = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  return store(input, admin.email, "imported a prep kit", `Imported "${file.name}".`);
}

export async function resetKitAction(): Promise<KitResult> {
  const admin = await requireAdmin();
  return store(defaultKit, admin.email, "reset the prep kit", "Back to the default kit.");
}
