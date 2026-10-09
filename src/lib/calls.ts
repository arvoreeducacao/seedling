export type CallKind = "user" | "tool" | "internal";

export type RecordedCall = { id: string; at: string; source: string; prompt: string | null; response: string | null; tools: string[]; cost: number; status: number; agent?: string };

export type Turn = { id: string; at: string; endAt: string; agent: string; source: string; prompt: string; response: string | null; tools: string[]; cost: number; steps: number; failed: number };

const internalPatterns = [
  /^\s*<session>/i,
  /write (?:a|the) (?:\d+-\d+ word )?title/i,
  /predominant language/i,
  /new conversation topic/i,
  /<policy_spec>/i,
  /command prefix/i,
  /extract any file paths/i,
  /create a detailed summary of the conversation/i,
  /^\s*quota\s*$/i,
  /^\s*warmup\s*$/i,
  /^\s*base directory for this skill:/i,
  /^\s*<system-reminder>/i,
  /^\s*caveat: the messages below were generated/i,
];

export function classifyCall(call: Pick<RecordedCall, "prompt" | "source">): CallKind {
  if (call.source === "panel") return call.prompt?.trim() ? "user" : "internal";
  const prompt = call.prompt?.trim() ?? "";
  if (!prompt) return "internal";
  if (/^\[\d+ tool result\(s\)\]$/.test(prompt)) return "tool";
  if (internalPatterns.some((re) => re.test(prompt))) return "internal";
  return "user";
}

export function groupTurns(calls: RecordedCall[]) {
  const ordered = [...calls].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const turns: Turn[] = [];
  const internal: RecordedCall[] = [];
  const currentBy = new Map<string, Turn>();
  for (const call of ordered) {
    const agent = call.agent ?? "main";
    let current = currentBy.get(agent) ?? null;
    const kind = classifyCall(call);
    if (kind === "internal") {
      internal.push(call);
      continue;
    }
    if (kind === "user") {
      current = { id: call.id, at: call.at, endAt: call.at, agent, source: call.source, prompt: call.prompt!.trim(), response: null, tools: [], cost: 0, steps: 0, failed: 0 };
      currentBy.set(agent, current);
      turns.push(current);
    }
    if (!current) {
      internal.push(call);
      continue;
    }
    current.steps += 1;
    current.endAt = call.at;
    current.cost += call.cost;
    if (call.status >= 400) current.failed += 1;
    for (const tool of call.tools) if (!current.tools.includes(tool)) current.tools.push(tool);
    if (call.response?.trim()) current.response = call.response;
  }
  return { turns, internal };
}
