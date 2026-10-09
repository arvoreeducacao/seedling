import { MAX_TEXT_FILE, candidateSession, dirSize, readWorkspaceFile, workspaceRoot, unauthorized } from "@/lib/candidate";
import { env } from "@/lib/env";
import { readInside, writeInside } from "@/lib/safe-path";
import { logEvent } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const MAX_FILE = MAX_TEXT_FILE;

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  const rel = new URL(req.url).searchParams.get("path") ?? "";
  try {
    return Response.json(await readWorkspaceFile(workspaceRoot(session), rel));
  } catch {
    return Response.json({ error: "file not found" }, { status: 404 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  const body = (await req.json().catch(() => null)) as { path?: string; content?: string } | null;
  if (!body?.path || typeof body.content !== "string") return Response.json({ error: "invalid body" }, { status: 400 });
  if (body.content.length > MAX_FILE) return Response.json({ error: "file too large" }, { status: 413 });
  try {
    const root = workspaceRoot(session);
    if ((await dirSize(root)) > env.sandbox.workspaceMaxMb * 1024 * 1024) return Response.json({ error: "the sandbox is over its disk limit" }, { status: 413 });
    const before = await readInside(root, body.path, MAX_FILE).then((r) => r.buffer?.toString("utf8") ?? null, () => null);
    await writeInside(root, body.path, body.content);
    const lines = body.content.split("\n").length;
    await logEvent(session.id, "file-save", "candidate", { path: body.path, lines, created: before === null, delta: body.content.length - (before?.length ?? 0) });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "could not save" }, { status: 400 });
  }
}
