"use client";

import { AppError, hasKey, type Key, type T } from "@/lib/i18n";

const claims = new Map<string, Promise<boolean>>();

export function claim(token: string, force = false) {
  if (force) claims.delete(token);
  let pending = claims.get(token);
  if (!pending) {
    pending = fetch(`/api/s/${token}/prep/claim`, { method: "POST" }).then((r) => r.ok).catch(() => false);
    claims.set(token, pending);
  }
  return pending;
}

export function prepError(error: unknown, t: T, fallback: Key) {
  if (error instanceof AppError) return t(error.key, error.params);
  if (error instanceof Error && error.message) return hasKey(error.message) ? t(error.message) : error.message;
  return t(fallback);
}

export async function prepFetch<Body>(token: string, path: string, init?: RequestInit): Promise<Body> {
  await claim(token);
  let res = await fetch(`/api/s/${token}/prep/${path}`, init);
  if (res.status === 401 && (await claim(token, true))) res = await fetch(`/api/s/${token}/prep/${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (typeof body.error === "string" && body.error) throw new Error(body.error);
    throw new AppError("prep.somethingWentWrong");
  }
  return body as Body;
}
