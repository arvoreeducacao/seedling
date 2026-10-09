import { candidateSession, unauthorized } from "@/lib/candidate";
import { previewInfo } from "@/lib/preview";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  return Response.json(await previewInfo(session));
}
