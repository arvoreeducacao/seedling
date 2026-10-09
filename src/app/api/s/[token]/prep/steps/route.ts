import { denied, prepClosedReason, prepSession } from "@/lib/prep/request";
import { markStep } from "@/lib/prep";
import { markable, type StepMark } from "@/lib/prep/steps";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await prepSession(token);
  if (!session) return denied();
  const shut = await prepClosedReason(session);
  if (shut) return shut;
  const body = (await req.json().catch(() => null)) as { mark?: unknown; on?: unknown } | null;
  const mark = typeof body?.mark === "string" && (markable as string[]).includes(body.mark) ? (body.mark as StepMark) : null;
  if (!mark) return Response.json({ error: "unknown step" }, { status: 400 });
  const stepsDone = await markStep(session.id, mark, body?.on !== false);
  return Response.json({ stepsDone });
}
