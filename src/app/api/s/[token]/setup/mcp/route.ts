import { addMcpServers } from "@/lib/setup/store";
import { attempt, denied, setupAccess } from "@/lib/setup/access";
import { parseMcpPaste } from "@/lib/setup/validate";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const access = await setupAccess((await params).token);
  if (!access) return denied();
  const body = (await req.json().catch(() => null)) as { json?: unknown } | null;
  return attempt(access, () => addMcpServers(access.session.id, parseMcpPaste(body?.json)));
}
