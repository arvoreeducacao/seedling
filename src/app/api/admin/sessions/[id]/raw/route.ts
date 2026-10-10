import { eq } from "drizzle-orm";
import { currentAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { rawFile } from "@/lib/raw-file";
import { workspaceDir } from "@/lib/sessions";
import { i18nFromRequest } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { t } = i18nFromRequest(req);
  const admin = await currentAdmin();
  if (!admin) return Response.json({ error: t("error.unauthorized") }, { status: 401 });
  const { id } = await params;
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, id) });
  if (!session) return Response.json({ error: t("error.notFound") }, { status: 404 });
  const url = new URL(req.url);
  const index = Number(url.searchParams.get("index") ?? session.currentIndex);
  if (!Number.isInteger(index) || index < 0 || index >= session.challengeIds.length) return Response.json({ error: t("server.invalidIndex") }, { status: 400 });
  return rawFile(workspaceDir(id, index), url.searchParams.get("path") ?? "", url.searchParams.has("download"));
}
