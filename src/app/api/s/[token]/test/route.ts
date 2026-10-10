import { candidateSession, unauthorized } from "@/lib/candidate";
import { activeChallenge } from "@/lib/active-challenge";
import { logEvent } from "@/lib/sessions";
import { sandbox } from "@/lib/sandbox";
import { parseTestCounts } from "@/lib/challenges/classify";
import { i18nFromRequest } from "@/lib/i18n/server";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  const { t } = i18nFromRequest(req);
  const challenge = await activeChallenge(session);
  const command = challenge?.visibleTestCommand;
  if (!command) return Response.json({ output: t("server.noVisibleTests"), passed: 0, total: 0 });
  const containerId = await sandbox().find(session.id);
  if (!containerId) return Response.json({ error: t("server.sandboxNotRunning") }, { status: 409 });
  const result = await sandbox().exec(containerId, command, 120_000);
  const counts = parseTestCounts(result.output, result.exitCode);
  await logEvent(session.id, "test-run", "candidate", { ...counts, exitCode: result.exitCode });
  return Response.json({ output: result.output.slice(-30_000), exitCode: result.exitCode, ...counts });
}
