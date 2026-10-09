const globalForShells = globalThis as unknown as { seedlingShellReset?: Map<string, () => void> };
export const shellResets = globalForShells.seedlingShellReset ?? new Map<string, () => void>();
globalForShells.seedlingShellReset = shellResets;

export function resetShell(sessionId: string) {
  for (const [key, reset] of [...shellResets]) if (key === sessionId || key.startsWith(`${sessionId}~`)) reset();
}

export function resetAgentShell(key: string) {
  shellResets.get(key)?.();
}

const globalForActivity = globalThis as unknown as { seedlingActivity?: Map<string, number> };
export const lastOutput = globalForActivity.seedlingActivity ?? new Map<string, number>();
globalForActivity.seedlingActivity = lastOutput;
