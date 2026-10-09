import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const result = await auth.api.signOut({ headers: req.headers, asResponse: true }).catch(() => null);
  const res = NextResponse.redirect(`${env.url}/login`, 303);
  for (const cookie of result?.headers.getSetCookie() ?? []) res.headers.append("set-cookie", cookie);
  return res;
}
