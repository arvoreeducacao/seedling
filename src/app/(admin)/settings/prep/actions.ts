"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveKit } from "@/lib/prep";
import { defaultKitFor, kitNoteText, kitProblemText, parseKit, type Kit } from "@/lib/prep/kit";
import type { Key, Params } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export type KitResult = { ok: true; kit: Kit; notes: string[]; message: string } | { ok: false; error: string };

const MAX_IMPORT = 256 * 1024;

async function challengeRefs() {
  return db.query.challenges.findMany({ columns: { id: true, slug: true, status: true } });
}

async function store(input: unknown, admin: string, action: Key, message: Key, params?: Params): Promise<KitResult> {
  const i18n = await getI18n();
  const parsed = parseKit(input, await challengeRefs());
  if (!parsed.ok) return { ok: false, error: kitProblemText(i18n, parsed) };
  await saveKit(parsed.kit, admin);
  await audit(admin, action, parsed.kit.name || "kit.audit.target");
  revalidatePath("/settings");
  revalidatePath("/settings/prep");
  return { ok: true, kit: parsed.kit, notes: parsed.notes.map((note) => kitNoteText(i18n, note)), message: i18n.t(message, params) };
}

export async function saveKitAction(json: string): Promise<KitResult> {
  const admin = await requireAdmin();
  const { t } = await getI18n();
  if (json.length > MAX_IMPORT) return { ok: false, error: t("kit.tooLarge") };
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    return { ok: false, error: t("kit.invalid") };
  }
  return store(input, admin.email, "kit.audit.saved", "kit.saved");
}

export async function importKitAction(_prev: KitResult | null, formData: FormData): Promise<KitResult> {
  const admin = await requireAdmin();
  const { t } = await getI18n();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: t("kit.pickFile") };
  if (file.size > MAX_IMPORT) return { ok: false, error: t("kit.fileTooLarge") };
  let input: unknown;
  try {
    input = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: t("kit.notJson") };
  }
  return store(input, admin.email, "kit.audit.imported", "kit.imported", { name: file.name });
}

export async function resetKitAction(): Promise<KitResult> {
  const admin = await requireAdmin();
  const { locale } = await getI18n();
  return store(defaultKitFor(locale), admin.email, "kit.audit.reset", "kit.resetDone");
}
