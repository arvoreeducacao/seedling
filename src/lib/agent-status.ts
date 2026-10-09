import { and, asc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { classifyCall } from "@/lib/calls";
import { terminalKey, type Session } from "@/lib/sessions";
import { agentStatus, type AgentStatus } from "@/lib/parallel";
import { lastOutput } from "@/server/terminal-registry";
import type { AgentInfo } from "@/lib/agents";

export async function withStatus(session: Session, agents: AgentInfo[]): Promise<(AgentInfo & { status: AgentStatus })[]> {
  const since = session.startedAt ?? new Date(0);
  const calls = await db.query.aiCalls.findMany({ where: and(eq(schema.aiCalls.sessionId, session.id), gte(schema.aiCalls.createdAt, since)), orderBy: asc(schema.aiCalls.createdAt) });
  const now = Date.now();
  return agents.map((agent) => {
    const mine = calls.filter((c) => c.agentKey === agent.key && classifyCall({ prompt: c.prompt, source: c.source }) !== "internal");
    const lastCallAt = mine.length ? mine[mine.length - 1].createdAt.getTime() : null;
    return { ...agent, status: agentStatus({ closed: Boolean(agent.closedAt), now, lastCallAt, lastOutputAt: lastOutput.get(terminalKey(session.id, agent.key)) ?? null }) };
  });
}
