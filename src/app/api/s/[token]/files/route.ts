import { candidateSession, listTree, workspaceRoot, unauthorized } from "@/lib/candidate";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  return Response.json({ files: await listTree(workspaceRoot(session)) });
}
