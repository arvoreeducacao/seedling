import { cookies } from "next/headers";
import { sessionByInvite, type Session } from "@/lib/sessions";
import { getI18n } from "@/lib/i18n/server";
import { PREP_COOKIE, loadKit, prepCookieValid, prepWindow } from "@/lib/prep";

export const MAX_BODY = 3 * 1024 * 1024;

export async function prepSession(token: string): Promise<Session | null> {
  const session = await sessionByInvite(token);
  if (!session || session.practiceOf) return null;
  const jar = await cookies();
  return prepCookieValid(session.id, jar.get(PREP_COOKIE)?.value) ? session : null;
}

export async function denied() {
  const { t } = await getI18n();
  return Response.json({ error: t("prep.reopenInvite") }, { status: 401 });
}

export function tooLarge(req: Request) {
  return Number(req.headers.get("content-length") ?? 0) > MAX_BODY;
}

export async function prepClosedReason(session: Session) {
  const state = prepWindow(await loadKit(), session);
  if (state.state === "open") return null;
  const { t } = await getI18n();
  return Response.json({ error: state.state === "upcoming" ? t("prep.notOpenYet") : t("prep.closed") }, { status: 409 });
}
