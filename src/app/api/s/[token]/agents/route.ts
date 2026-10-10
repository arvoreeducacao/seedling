import { candidateSession, errorText, unauthorized } from "@/lib/candidate";
import { createAgent, listAgents } from "@/lib/agents";
import { env } from "@/lib/env";
import { withStatus } from "@/lib/agent-status";
import { i18nFromRequest } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  return Response.json({ agents: await withStatus(session, await listAgents(session)), max: env.sandbox.maxAgents });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  try {
    return Response.json({ agent: await createAgent(session, body.name) });
  } catch (error) {
    return Response.json({ error: errorText(error, i18nFromRequest(req).t, "server.agentOpenFailed") }, { status: 400 });
  }
}
