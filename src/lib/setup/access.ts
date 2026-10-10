import { cookies } from "next/headers";
import { CANDIDATE_COOKIE, candidateOwns, sessionByInvite, type Session } from "@/lib/sessions";
import { getI18n } from "@/lib/i18n/server";
import { SetupError } from "./validate";
import { setupView } from "./store";

export type SetupAccess = { session: Session; editable: boolean };

export async function setupAccess(token: string): Promise<SetupAccess | null> {
  const session = await sessionByInvite(token);
  if (!session) return null;
  if (session.status === "invited") return session.inviteExpiresAt.getTime() > Date.now() ? { session, editable: true } : null;
  const jar = await cookies();
  return candidateOwns(session, jar.get(CANDIDATE_COOKIE)?.value) ? { session, editable: false } : null;
}

export async function denied() {
  const { t } = await getI18n();
  return Response.json({ error: t("setup.sessionInvalid") }, { status: 401 });
}

export async function locked() {
  const { t } = await getI18n();
  return Response.json({ error: t("setup.lockedError") }, { status: 409 });
}

export async function respond(access: SetupAccess) {
  return Response.json({ setup: await setupView(access.session.id), editable: access.editable });
}

export async function attempt(access: SetupAccess, work: () => Promise<unknown>) {
  if (!access.editable) return locked();
  const { t } = await getI18n();
  try {
    await work();
  } catch (error) {
    if (error instanceof SetupError) return Response.json({ error: t(error.key, error.params) }, { status: 400 });
    console.error("[seedling] setup update failed", access.session.id);
    return Response.json({ error: t("setup.saveFailed") }, { status: 500 });
  }
  return respond(access);
}
