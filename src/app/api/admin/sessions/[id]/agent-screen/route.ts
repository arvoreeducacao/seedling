import { eq } from "drizzle-orm";
import { currentAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { agentShot, shotResponse } from "@/lib/preview";
import { i18nFromRequest } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { t } = i18nFromRequest(req);
  const admin = await currentAdmin();
  if (!admin) return Response.json({ error: t("error.unauthorized") }, { status: 401 });
  const { id } = await params;
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, id) });
  if (!session || session.status !== "running") return Response.json({ error: t("server.sessionNotRunning") }, { status: 404 });
  return shotResponse(await agentShot(session));
}
