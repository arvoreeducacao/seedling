import { eq } from "drizzle-orm";
import { currentAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { rawFile } from "@/lib/raw-file";
import { workspaceDir } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, id) });
  if (!session) return Response.json({ error: "not found" }, { status: 404 });
  const url = new URL(req.url);
  const index = Number(url.searchParams.get("index") ?? session.currentIndex);
  if (!Number.isInteger(index) || index < 0 || index >= session.challengeIds.length) return Response.json({ error: "invalid index" }, { status: 400 });
  return rawFile(workspaceDir(id, index), url.searchParams.get("path") ?? "", url.searchParams.has("download"));
}
