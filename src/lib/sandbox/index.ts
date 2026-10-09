import { env } from "@/lib/env";
import { dockerDriver } from "./docker";
import type { SandboxDriver } from "./types";

const globalForSandbox = globalThis as unknown as { seedlingSandbox?: SandboxDriver };

export function sandbox(): SandboxDriver {
  if (!globalForSandbox.seedlingSandbox) {
    if (env.sandbox.driver !== "docker") throw new Error(`unknown sandbox driver: ${env.sandbox.driver}`);
    globalForSandbox.seedlingSandbox = dockerDriver();
  }
  return globalForSandbox.seedlingSandbox;
}

export type { SandboxDriver } from "./types";
