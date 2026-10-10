import { MAX_TEXT_FILE, candidateSession, listTree, readWorkspaceFile, workspaceRoot, unauthorized } from "@/lib/candidate";
import { activeChallenge } from "@/lib/active-challenge";
import { forwardMessages } from "@/lib/gateway";
import { passStore } from "@/lib/sessions";
import { i18nFromRequest } from "@/lib/i18n/server";

type Msg = { role: "user" | "assistant"; content: string };

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await candidateSession(token);
  if (!session || session.status !== "running") return unauthorized();
  const i18n = i18nFromRequest(req);
  const { t } = i18n;
  const body = (await req.json().catch(() => null)) as { messages?: Msg[]; openFile?: string } | null;
  const history = (body?.messages ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()).slice(-30);
  if (!history.length || history[history.length - 1].role !== "user") return Response.json({ error: t("server.emptyMessage") }, { status: 400 });
  const pass = await passStore.get(session.id);
  if (!pass) return Response.json({ error: t("server.aiOff") }, { status: 403 });
  const challenge = await activeChallenge(session);
  const root = workspaceRoot(session);
  const tree = (await listTree(root, 300)).filter((f) => !f.dir).map((f) => f.path);
  let open = "";
  if (typeof body?.openFile === "string" && body.openFile) {
    const file = await readWorkspaceFile(root, body.openFile).catch(() => null);
    if (file && typeof file.content === "string" && file.size <= MAX_TEXT_FILE) {
      open = `\n\nFile open in the editor (${body.openFile}):\n\`\`\`\n${file.content.slice(0, 40_000)}\n\`\`\``;
    }
  }
  const system = [
    "You are Claude, helping a candidate in a coding interview where using AI is allowed and expected.",
    "Answer directly, in the language the candidate writes in. Show code in fenced blocks with the language set and, when a block is the whole content of a file, put its path on the first line as a comment.",
    "You cannot see the terminal or run commands. If you need something, ask the candidate to run it and paste the output.",
    `Challenge: ${challenge?.title ?? ""}`,
    `Statement:\n${(challenge?.statement ?? "").slice(0, 20_000)}`,
    `Sandbox files:\n${tree.join("\n")}`,
    open,
  ].join("\n\n");
  const upstream = new Request("http://seedling.internal/v1/messages", {
    method: "POST",
    headers: { authorization: `Bearer ${pass}`, "content-type": "application/json", "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: session.model, max_tokens: 8000, system, messages: history, stream: true }),
  });
  return forwardMessages(upstream, "panel", i18n.locale);
}
