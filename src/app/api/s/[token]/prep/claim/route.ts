import { cookies } from "next/headers";
import { sessionByInvite } from "@/lib/sessions";
import { PREP_COOKIE, prepCookieOptions, prepCookieValue, touchProgress } from "@/lib/prep";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await sessionByInvite(token);
  if (!session || session.practiceOf || session.status !== "invited") return Response.json({ error: "This link can't open a prep space." }, { status: 404 });
  const jar = await cookies();
  jar.set(PREP_COOKIE, prepCookieValue(session.id), prepCookieOptions());
  await touchProgress(session.id);
  return Response.json({ ok: true });
}
