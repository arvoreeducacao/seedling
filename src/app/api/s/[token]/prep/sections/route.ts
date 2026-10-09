import { denied, prepClosedReason, prepSession } from "@/lib/prep/request";
import { loadKit, markSection } from "@/lib/prep";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await prepSession(token);
  if (!session) return denied();
  const shut = await prepClosedReason(session);
  if (shut) return shut;
  const body = (await req.json().catch(() => null)) as { sectionId?: unknown; done?: unknown } | null;
  const kit = await loadKit();
  const sectionId = typeof body?.sectionId === "string" ? body.sectionId : "";
  if (!kit.sections.some((s) => s.id === sectionId)) return Response.json({ error: "unknown section" }, { status: 400 });
  const done = await markSection(session.id, sectionId, body?.done !== false);
  return Response.json({ done });
}
