import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { kitUpdatedAt, loadKit } from "@/lib/prep";
import { displayName, when } from "@/lib/format";
import { KitEditor } from "./kit-editor";

export const metadata: Metadata = { title: "Candidate prep" };
export const dynamic = "force-dynamic";

export default async function PrepSettingsPage() {
  await requireAdmin();
  const [kit, updated, challenges] = await Promise.all([
    loadKit(),
    kitUpdatedAt(),
    db.query.challenges.findMany({ where: eq(schema.challenges.status, "published"), orderBy: desc(schema.challenges.createdAt) }),
  ]);
  return (
    <>
      <PageHeader crumb="Settings" crumbHref="/settings" title="Candidate prep" />
      <KitEditor
        initial={kit}
        challenges={challenges.map((c) => ({ id: c.id, title: c.title, minutes: c.minutes }))}
        updated={updated ? `${when(updated.updatedAt)}${updated.updatedBy ? ` by ${displayName(updated.updatedBy)}` : ""}` : null}
      />
    </>
  );
}
