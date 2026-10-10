"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { messageOf } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { CANDIDATE_COOKIE, sessionByInvite, startSession } from "@/lib/sessions";

export async function begin(token: string, _prev: string | null, formData: FormData): Promise<string | null> {
  const { t } = await getI18n();
  if (formData.get("consent") !== "on") return t("candidate.consentRequired");
  const session = await sessionByInvite(token);
  if (!session) return t("candidate.linkMissing.short");
  try {
    const cookie = await startSession(session);
    const jar = await cookies();
    jar.set(CANDIDATE_COOKIE, cookie, { httpOnly: true, sameSite: "lax", secure: env.secureCookies, path: "/", maxAge: 12 * 3600 });
  } catch (error) {
    return messageOf(error, t, "candidate.startFailed");
  }
  redirect(`/s/${token}/w`);
}
