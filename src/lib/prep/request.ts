import { cookies } from "next/headers";
import { sessionByInvite, type Session } from "@/lib/sessions";
import { PREP_COOKIE, loadKit, prepCookieValid, prepWindow } from "@/lib/prep";

export const MAX_BODY = 3 * 1024 * 1024;

export async function prepSession(token: string): Promise<Session | null> {
  const session = await sessionByInvite(token);
  if (!session || session.practiceOf) return null;
  const jar = await cookies();
  return prepCookieValid(session.id, jar.get(PREP_COOKIE)?.value) ? session : null;
}

export function denied(message = "Open your invite link again to continue.") {
  return Response.json({ error: message }, { status: 401 });
}

export function tooLarge(req: Request) {
  return Number(req.headers.get("content-length") ?? 0) > MAX_BODY;
}

export async function prepClosedReason(session: Session) {
  const state = prepWindow(await loadKit(), session);
  if (state.state === "open") return null;
  return Response.json({ error: state.state === "upcoming" ? "Your prep space isn't open yet." : "Prep is closed once the interview starts." }, { status: 409 });
}
