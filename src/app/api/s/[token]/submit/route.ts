import { candidateSession, unauthorized } from "@/lib/candidate";
import { submitCurrent } from "@/lib/sessions";
import { resetShell } from "@/server/terminal-registry";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  resetShell(session.id);
  try {
    const result = await submitCurrent(session, "candidate");
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "could not submit" }, { status: 400 });
  }
}
