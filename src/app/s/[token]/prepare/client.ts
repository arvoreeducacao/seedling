"use client";

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

export async function prepFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  await claim(token);
  let res = await fetch(`/api/s/${token}/prep/${path}`, init);
  if (res.status === 401 && (await claim(token, true))) res = await fetch(`/api/s/${token}/prep/${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Something went wrong. Try again.");
  return body as T;
}
