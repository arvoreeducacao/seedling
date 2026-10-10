import { candidateSession, errorText, unauthorized } from "@/lib/candidate";
import { submitCurrent } from "@/lib/sessions";
import { resetShell } from "@/server/terminal-registry";
import { i18nFromRequest } from "@/lib/i18n/server";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  resetShell(session.id);
  try {
    const result = await submitCurrent(session, "candidate");
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: errorText(error, i18nFromRequest(req).t, "server.submitFailed") }, { status: 400 });
  }
}
