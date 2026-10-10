import { candidateSession, unauthorized } from "@/lib/candidate";
import { logEvent } from "@/lib/sessions";
import { i18nFromRequest } from "@/lib/i18n/server";

const allowed = new Set(["paste", "file-open", "apply-ai", "browse"]);

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  const body = (await req.json().catch(() => null)) as { kind?: string; data?: Record<string, unknown> } | null;
  if (!body?.kind || !allowed.has(body.kind)) return Response.json({ error: i18nFromRequest(req).t("server.invalidEvent") }, { status: 400 });
  const data = Object.fromEntries(Object.entries(body.data ?? {}).slice(0, 8).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 300) : typeof v === "number" ? v : null]));
  await logEvent(session.id, body.kind as "paste", "candidate", data);
  return Response.json({ ok: true });
}
