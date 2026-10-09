"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { CANDIDATE_COOKIE, sessionByInvite, startSession } from "@/lib/sessions";

export async function begin(token: string, _prev: string | null, formData: FormData): Promise<string | null> {
  if (formData.get("consent") !== "on") return "Confirm that you read the rules and agree to the recording.";
  const session = await sessionByInvite(token);
  if (!session) return "This link doesn't exist.";
  try {
    const cookie = await startSession(session);
    const jar = await cookies();
    jar.set(CANDIDATE_COOKIE, cookie, { httpOnly: true, sameSite: "lax", secure: env.secureCookies, path: "/", maxAge: 12 * 3600 });
  } catch (error) {
    return error instanceof Error ? error.message : "Could not start the session.";
  }
  redirect(`/s/${token}/w`);
}
