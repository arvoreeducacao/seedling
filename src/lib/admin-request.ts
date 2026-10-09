import type { IncomingMessage } from "node:http";
import { isAdminEmail } from "@/lib/admins";
import { emailFromHeaders } from "@/lib/better-auth";

export async function adminFromRequest(req: IncomingMessage) {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const user = await emailFromHeaders(new Headers({ cookie }));
  if (!user || !(await isAdminEmail(user.email))) return null;
  return user;
}
