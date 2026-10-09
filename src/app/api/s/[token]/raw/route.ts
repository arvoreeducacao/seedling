import { candidateSession, unauthorized } from "@/lib/candidate";
import { rawFile } from "@/lib/raw-file";
import { workspaceDir } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  const url = new URL(req.url);
  return rawFile(workspaceDir(session.id, session.currentIndex), url.searchParams.get("path") ?? "", url.searchParams.has("download"));
}
