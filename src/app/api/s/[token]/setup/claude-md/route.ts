import { setClaudeMd } from "@/lib/setup/store";
import { attempt, denied, setupAccess } from "@/lib/setup/access";
import { checkClaudeMd } from "@/lib/setup/validate";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function PUT(req: Request, { params }: Params) {
  const access = await setupAccess((await params).token);
  if (!access) return denied();
  const body = (await req.json().catch(() => null)) as { content?: unknown } | null;
  return attempt(access, () => setClaudeMd(access.session.id, checkClaudeMd(body?.content)));
}

export async function DELETE(_req: Request, { params }: Params) {
  const access = await setupAccess((await params).token);
  return access ? attempt(access, () => setClaudeMd(access.session.id, null)) : denied();
}
