import type { Turn } from "@/lib/calls";

export type AgentStatus = "working" | "waiting" | "idle" | "closed";

export const WORKING_AFTER_CALL_MS = 20_000;
export const WORKING_AFTER_OUTPUT_MS = 3_000;
const TURN_LEAD_MS = 5_000;

export function agentStatus(input: { closed: boolean; now: number; lastCallAt: number | null; lastOutputAt: number | null }): AgentStatus {
  if (input.closed) return "closed";
  const sinceCall = input.lastCallAt === null ? Infinity : input.now - input.lastCallAt;
  const sinceOutput = input.lastOutputAt === null ? Infinity : input.now - input.lastOutputAt;
  if (sinceCall < WORKING_AFTER_CALL_MS) return "working";
  if (sinceOutput < WORKING_AFTER_OUTPUT_MS && sinceCall < 120_000) return "working";
  return input.lastCallAt === null ? "idle" : "waiting";
}

export type Lane = {
  key: string;
  name: string;
  openedAt: number;
  closedAt: number | null;
  spans: { start: number; end: number }[];
  workingMs: number;
  waitingMs: number;
  prompts: number;
  cost: number;
};

export type Parallelism = { start: number; end: number; minutes: number[]; lanes: Lane[]; peak: number; overlapMs: number };

export function parallelism(input: { start: number; end: number; agents: { key: string; name: string; openedAt: number; closedAt: number | null }[]; turns: Pick<Turn, "agent" | "at" | "endAt" | "cost">[] }): Parallelism {
  const { start, end } = input;
  const lanes: Lane[] = input.agents.map((agent) => {
    const turns = input.turns.filter((t) => t.agent === agent.key).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const spans: Lane["spans"] = [];
    for (const turn of turns) {
      const s = Math.max(start, agent.openedAt, Date.parse(turn.at) - TURN_LEAD_MS);
      const e = Math.min(end, Math.max(s, Date.parse(turn.endAt)));
      const last = spans[spans.length - 1];
      if (last && s <= last.end) last.end = Math.max(last.end, e);
      else spans.push({ start: s, end: e });
    }
    const workingMs = spans.reduce((n, sp) => n + (sp.end - sp.start), 0);
    const until = Math.min(end, agent.closedAt ?? end);
    let waitingMs = 0;
    for (let i = 0; i < spans.length; i++) {
      const next = spans[i + 1]?.start ?? until;
      waitingMs += Math.max(0, Math.min(next, until) - spans[i].end);
    }
    return { ...agent, spans, workingMs, waitingMs, prompts: turns.length, cost: turns.reduce((n, t) => n + t.cost, 0) };
  });
  const count = Math.max(1, Math.ceil((end - start) / 60_000));
  const minutes = Array.from({ length: count }, (_, m) => {
    const a = start + m * 60_000;
    const b = a + 60_000;
    return lanes.filter((lane) => lane.spans.some((sp) => sp.start < b && sp.end > a)).length;
  });
  const edges = lanes.flatMap((lane) => lane.spans.flatMap((sp) => [{ t: sp.start, d: 1 }, { t: sp.end, d: -1 }])).sort((x, y) => x.t - y.t || x.d - y.d);
  let running = 0;
  let peak = 0;
  let overlapMs = 0;
  let prev = start;
  for (const edge of edges) {
    if (running >= 2) overlapMs += edge.t - prev;
    running += edge.d;
    peak = Math.max(peak, running);
    prev = edge.t;
  }
  return { start, end, minutes, lanes, peak, overlapMs };
}
