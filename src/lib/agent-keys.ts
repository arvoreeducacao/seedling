export const MAIN_AGENT = "main";
export const AGENT_HEADER = "x-seedling-agent";

const keyPattern = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function validAgentKey(key: string | null | undefined): key is string {
  return typeof key === "string" && keyPattern.test(key);
}
