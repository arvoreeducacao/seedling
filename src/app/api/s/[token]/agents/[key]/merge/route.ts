import { candidateSession, errorText, unauthorized } from "@/lib/candidate";
import { MAIN_AGENT, mergeAgent, validAgentKey } from "@/lib/agents";
import { i18nFromRequest } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string; key: string }> }) {
  const { token, key } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  const { t } = i18nFromRequest(req);
  if (key === MAIN_AGENT || !validAgentKey(key)) return Response.json({ error: t("server.nothingToMerge") }, { status: 400 });
  try {
    const result = await mergeAgent(session, key);
    return Response.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    return Response.json({ ok: false, conflicts: [], message: errorText(error, t, "server.mergeFailed") }, { status: 400 });
  }
}
