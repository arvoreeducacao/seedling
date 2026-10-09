import { candidateSession, unauthorized } from "@/lib/candidate";
import { MAIN_AGENT, closeAgent, renameAgent, validAgentKey } from "@/lib/agents";
import { terminalKey } from "@/lib/sessions";
import { resetAgentShell } from "@/server/terminal-registry";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string; key: string }> };

async function target({ params }: Params) {
  const { token, key } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return null;
  return { session, key };
}

export async function PATCH(req: Request, ctx: Params) {
  const found = await target(ctx);
  if (!found) return unauthorized();
  if (found.key === MAIN_AGENT || !validAgentKey(found.key)) return Response.json({ error: "the main agent keeps its name" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  try {
    return Response.json({ agent: await renameAgent(found.session, found.key, body.name) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "could not rename" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Params) {
  const found = await target(ctx);
  if (!found) return unauthorized();
  if (found.key === MAIN_AGENT || !validAgentKey(found.key)) return Response.json({ error: "the main agent can't be closed" }, { status: 400 });
  try {
    resetAgentShell(terminalKey(found.session.id, found.key));
    await closeAgent(found.session, found.key);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "could not close" }, { status: 400 });
  }
}
