export type SetupPolicy = { skills: boolean; claudeMd: boolean; mcpServers: boolean };

export type SetupCategory = keyof SetupPolicy;

const ALIASES: Record<string, SetupCategory[]> = {
  all: ["skills", "claudeMd", "mcpServers"],
  skills: ["skills"],
  "claude-md": ["claudeMd"],
  claudemd: ["claudeMd"],
  mcp: ["mcpServers"],
  "mcp-servers": ["mcpServers"],
  mcpservers: ["mcpServers"],
};

export function policyFromEnv(value: string | undefined): SetupPolicy {
  const policy: SetupPolicy = { skills: true, claudeMd: true, mcpServers: true };
  for (const item of (value ?? "").split(",")) {
    for (const key of ALIASES[item.trim().toLowerCase()] ?? []) policy[key] = false;
  }
  return policy;
}

export async function setupPolicy(): Promise<SetupPolicy> {
  const { loadKit } = await import("@/lib/prep");
  const { bring } = await loadKit();
  const disabled = policyFromEnv(process.env.SEEDLING_SETUP_DISABLE);
  return { skills: bring.skills && disabled.skills, claudeMd: bring.claudeMd && disabled.claudeMd, mcpServers: bring.mcpServers && disabled.mcpServers };
}

export function anyEnabled(policy: SetupPolicy) {
  return policy.skills || policy.claudeMd || policy.mcpServers;
}
