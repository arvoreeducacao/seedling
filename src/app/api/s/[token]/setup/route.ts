import { clearSetup } from "@/lib/setup/store";
import { attempt, denied, respond, setupAccess } from "@/lib/setup/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Params) {
  const access = await setupAccess((await params).token);
  return access ? respond(access) : denied();
}

export async function DELETE(_req: Request, { params }: Params) {
  const access = await setupAccess((await params).token);
  return access ? attempt(access, () => clearSetup(access.session.id)) : denied();
}
