import { candidateSession, unauthorized } from "@/lib/candidate";
import { agentChanges } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string; key: string }> }) {
  const { token, key } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  try {
    return Response.json({ changes: await agentChanges(session, key) });
  } catch (error) {
    return Response.json({ changes: [], error: error instanceof Error ? error.message : "could not read the diff" });
  }
}
