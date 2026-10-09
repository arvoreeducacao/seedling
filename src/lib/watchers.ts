const globalForWatch = globalThis as unknown as { seedlingWatchers?: Map<string, Map<string, number>> };
const watchers = globalForWatch.seedlingWatchers ?? new Map<string, Map<string, number>>();
globalForWatch.seedlingWatchers = watchers;

export function markWatching(sessionId: string, email: string) {
  const map = watchers.get(sessionId) ?? new Map<string, number>();
  map.set(email, Date.now());
  watchers.set(sessionId, map);
}

export function currentWatchers(sessionId: string) {
  const map = watchers.get(sessionId);
  if (!map) return [];
  const cutoff = Date.now() - 20_000;
  return [...map.entries()].filter(([, at]) => at > cutoff).map(([email]) => email);
}
