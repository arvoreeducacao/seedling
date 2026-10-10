import path from "node:path";
import { currentAdmin } from "@/lib/auth";
import { listTree } from "@/lib/candidate";
import { remainingMs, sessionDetail, workspaceDir } from "@/lib/sessions";
import { markWatching } from "@/lib/watchers";
import { displayName } from "@/lib/format";
import { groupTurns } from "@/lib/calls";
import { listAgents } from "@/lib/agents";
import { withStatus } from "@/lib/agent-status";
import { i18nFromRequest } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { t } = i18nFromRequest(req);
  const admin = await currentAdmin();
  if (!admin) return Response.json({ error: t("error.unauthorized") }, { status: 401 });
  const { id } = await params;
  const detail = await sessionDetail(id);
  if (!detail) return Response.json({ error: t("error.notFound") }, { status: 404 });
  const { session, calls, events, challenges, attempts, spent, aiActive } = detail;
  if (session.status === "running") markWatching(id, admin.email);
  const root = workspaceDir(id, session.currentIndex);
  const lastOpen = [...events].reverse().find((e) => e.kind === "file-open" || e.kind === "file-save");
  const recorded = calls.map((c) => ({ id: c.id, at: c.createdAt.toISOString(), source: c.source, prompt: c.prompt, response: c.response, tools: c.toolUses, cost: c.costUsd, status: c.status, agent: c.agentKey }));
  const { turns } = groupTurns(recorded);
  const agents = (await withStatus(session, await listAgents(session))).map((agent) => {
    const mine = calls.filter((c) => c.agentKey === agent.key);
    const last = [...turns].reverse().find((t) => t.agent === agent.key);
    return {
      ...agent,
      lastPrompt: last?.prompt.slice(0, 280) ?? null,
      lastPromptAt: last?.at ?? null,
      prompts: turns.filter((t) => t.agent === agent.key).length,
      cost: mine.reduce((n, c) => n + c.costUsd, 0),
    };
  });;
  return Response.json({
    status: session.status,
    remainingMs: remainingMs(session),
    currentIndex: session.currentIndex,
    total: session.challengeIds.length,
    challenge: challenges[session.currentIndex] ? { title: challenges[session.currentIndex].title, kind: challenges[session.currentIndex].kind, traps: challenges[session.currentIndex].traps } : null,
    candidate: displayName(session.candidateEmail, session.candidateName),
    files: session.status === "running" ? await listTree(path.resolve(root), 800) : [],
    focus: lastOpen ? String(lastOpen.data.path ?? "") : null,
    spent,
    budget: session.budgetUsd,
    aiActive,
    tests: [...events].reverse().find((e) => e.kind === "test-run")?.data ?? null,
    calls: calls.map((c) => ({ id: c.id, at: c.createdAt, source: c.source, prompt: c.prompt, response: c.response, tools: c.toolUses, cost: c.costUsd, status: c.status, agent: c.agentKey })),
    agents,
    events: events.slice(-200).map((e) => ({ id: e.id, at: e.createdAt, kind: e.kind, actor: e.actor === "candidate" || e.actor === "system" ? e.actor : displayName(e.actor), data: e.data })),
    startedAt: session.startedAt,
    attempts: attempts.map((a) => ({ index: a.index, submittedAt: a.submittedAt, startedAt: a.startedAt })),
  });
}
