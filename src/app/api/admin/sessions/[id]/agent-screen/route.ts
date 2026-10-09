import { eq } from "drizzle-orm";
import { currentAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { agentShot, shotResponse } from "@/lib/preview";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, id) });
  if (!session || session.status !== "running") return Response.json({ error: "the session is not running" }, { status: 404 });
  return shotResponse(await agentShot(session));
}
