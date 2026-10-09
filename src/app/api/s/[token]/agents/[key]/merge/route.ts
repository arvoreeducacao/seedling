import { candidateSession, unauthorized } from "@/lib/candidate";
import { MAIN_AGENT, mergeAgent, validAgentKey } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string; key: string }> }) {
  const { token, key } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  if (key === MAIN_AGENT || !validAgentKey(key)) return Response.json({ error: "nothing to merge" }, { status: 400 });
  try {
    const result = await mergeAgent(session, key);
    return Response.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    return Response.json({ ok: false, conflicts: [], message: error instanceof Error ? error.message : "could not merge" }, { status: 400 });
  }
}
