import { AGENT_PORTS } from "./agent-browser";

export const TICKET_TTL_MS = 2 * 60_000;
export const PASS_TTL_MS = 8 * 60 * 60_000;
export const PREVIEW_COOKIE = "__seedling_preview";
const PASS_GRACE_MS = 5 * 60_000;

export function passLifetime(sessionRemainingMs: number) {
  return Math.max(60_000, Math.min(PASS_TTL_MS, sessionRemainingMs + PASS_GRACE_MS));
}

export function previewPortAllowed(port: number) {
  return Number.isInteger(port) && port >= 0 && port <= 65535 && !AGENT_PORTS.has(port);
}
