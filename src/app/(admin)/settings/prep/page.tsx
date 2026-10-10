import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { kitUpdatedAt, loadKit } from "@/lib/prep";
import { displayName, when } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { KitEditor } from "./kit-editor";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("settings.prep.title") };
}

export const dynamic = "force-dynamic";

export default async function PrepSettingsPage() {
  await requireAdmin();
  const i18n = await getI18n();
  const { t } = i18n;
  const [savedKit, updated, challenges] = await Promise.all([
    loadKit(),
    kitUpdatedAt(),
    db.query.challenges.findMany({ where: eq(schema.challenges.status, "published"), orderBy: desc(schema.challenges.createdAt) }),
  ]);
  const saved = updated ? when(i18n, updated.updatedAt) : null;
  return (
    <>
      <PageHeader crumb={t("settings.title")} crumbHref="/settings" title={t("settings.prep.title")} />
      <KitEditor
        initial={savedKit}
        challenges={challenges.map((c) => ({ id: c.id, title: c.title, minutes: c.minutes }))}
        updated={saved && updated?.updatedBy ? t("kit.updatedBy", { when: saved, who: displayName(updated.updatedBy) }) : saved}
      />
    </>
  );
}
