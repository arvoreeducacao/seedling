import { candidateSession, errorText, unauthorized } from "@/lib/candidate";
import { agentChanges } from "@/lib/agents";
import { i18nFromRequest } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string; key: string }> }) {
  const { token, key } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  try {
    return Response.json({ changes: await agentChanges(session, key) });
  } catch (error) {
    const { t } = i18nFromRequest(req);
    return Response.json({ changes: [], error: errorText(error, t, "server.diffFailed") });
  }
}
