import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { i18nFromRequest } from "@/lib/i18n/server";
import { loadKit } from "@/lib/prep";
import { exportKit } from "@/lib/prep/kit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await currentAdmin();
  const { t } = i18nFromRequest(req);
  if (!admin) return Response.json({ error: t("error.unauthorized") }, { status: 401 });
  const [kit, challenges] = await Promise.all([loadKit(), db.query.challenges.findMany({ columns: { id: true, slug: true, status: true } })]);
  const name = (kit.name || "prep-kit").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "prep-kit";
  return new Response(`${JSON.stringify(exportKit(kit, challenges), null, 2)}\n`, {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${name}.json"`, "cache-control": "no-store" },
  });
}
