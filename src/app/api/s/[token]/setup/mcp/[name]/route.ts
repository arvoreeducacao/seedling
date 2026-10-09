import { removeMcpServer } from "@/lib/setup/store";
import { attempt, denied, setupAccess } from "@/lib/setup/access";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string; name: string }> }) {
  const { token, name } = await params;
  const access = await setupAccess(token);
  return access ? attempt(access, () => removeMcpServer(access.session.id, decodeURIComponent(name))) : denied();
}
