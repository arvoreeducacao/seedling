import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type PreviewTicket = { kind: "ticket"; session: string; expires: number };
export type PreviewPass = { kind: "pass"; session: string; port: number; expires: number };

export function previewSigner(secret: string) {
  const key = createHmac("sha256", secret).update("seedling-preview").digest();
  const mac = (body: string) => createHmac("sha256", key).update(body).digest("base64url");

  function sign(payload: PreviewTicket | PreviewPass) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${mac(body)}`;
  }

  function verify<K extends "ticket" | "pass">(token: string | undefined | null, kind: K, now = Date.now()): Extract<PreviewTicket | PreviewPass, { kind: K }> | null {
    if (!token) return null;
    const [body, signature, extra] = token.split(".");
    if (!body || !signature || extra !== undefined) return null;
    const expected = Buffer.from(mac(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      if (payload?.kind !== kind || typeof payload.session !== "string" || typeof payload.expires !== "number") return null;
      if (payload.expires < now) return null;
      if (kind === "pass" && !(Number.isInteger(payload.port) && payload.port >= 0 && payload.port <= 65535)) return null;
      return payload;
    } catch {
      return null;
    }
  }

  return { sign, verify };
}

const globalForPreview = globalThis as unknown as { seedlingPreviewSecret?: string };

export function previewSecret(configured: string) {
  if (configured) return configured;
  globalForPreview.seedlingPreviewSecret ??= randomBytes(32).toString("hex");
  return globalForPreview.seedlingPreviewSecret;
}
