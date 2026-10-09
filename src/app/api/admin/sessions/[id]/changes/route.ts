import { eq } from "drizzle-orm";
import { currentAdmin } from "@/lib/auth";
import { workspaceChanges } from "@/lib/changes";
import { db, schema } from "@/lib/db";
import { MAIN_AGENT, agentChanges } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, id) });
  if (!session) return Response.json({ error: "not found" }, { status: 404 });
  const agent = new URL(req.url).searchParams.get("agent") ?? MAIN_AGENT;
  if (agent !== MAIN_AGENT) return Response.json({ changes: await agentChanges(session, agent).catch(() => []) });
  return Response.json({ changes: await workspaceChanges(session) });
}
