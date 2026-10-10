"use server";

import Anthropic from "@anthropic-ai/sdk";
import { groupTurns } from "@/lib/calls";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { audit, requireAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/crypto";
import { env } from "@/lib/env";
import { criteria } from "@/lib/evaluation";
import { getLocale } from "@/lib/i18n/server";
import { prompts } from "@/lib/i18n/prompts";
import { sessionDetail } from "@/lib/sessions";

export async function saveEvaluation(sessionId: string, formData: FormData) {
  const admin = await requireAdmin();
  const scores = Object.fromEntries(criteria.map((c) => [c.key, Math.max(0, Math.min(4, Number(formData.get(c.key) ?? 0)))]));
  const trapsFound = formData.getAll("trap").map(String);
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const existing = await db.query.evaluations.findFirst({ where: (t, { and }) => and(eq(t.sessionId, sessionId), eq(t.evaluator, admin.email)) });
  if (existing) {
    await db.update(schema.evaluations).set({ scores, trapsFound, comment, updatedAt: new Date() }).where(eq(schema.evaluations.id, existing.id));
  } else {
    await db.insert(schema.evaluations).values({ id: newId(), sessionId, evaluator: admin.email, scores, trapsFound, comment });
  }
  await audit(admin.email, "report.audit.reviewed", sessionId);
  revalidatePath(`/sessions/${sessionId}/report`);
}

export async function decide(sessionId: string, decision: "advance" | "talk" | "reject") {
  const admin = await requireAdmin();
  await db.update(schema.sessions).set({ decision, decidedBy: admin.email }).where(eq(schema.sessions.id, sessionId));
  await audit(admin.email, `report.audit.decided.${decision}`, sessionId);
  revalidatePath(`/sessions/${sessionId}/report`);
}

export async function generateDefense(sessionId: string) {
  const admin = await requireAdmin();
  if (!env.anthropicKey) return;
  const detail = await sessionDetail(sessionId);
  if (!detail) return;
  const { challenges, attempts, calls, events } = detail;
  const prompt = prompts(await getLocale());
  const summary = [
    ...challenges.map((c, i) => {
      const a = attempts.find((x) => x.index === i);
      return prompt("defense.challenge", { n: i + 1, title: c.title, passed: a?.hiddenPassed ?? "?", total: a?.hiddenTotal ?? "?", traps: c.traps.join("; ") || prompt("defense.noTraps") });
    }),
    prompt("defense.requests"),
    ...groupTurns(calls.map((c) => ({ id: c.id, at: new Date(c.createdAt).toISOString(), source: c.source, prompt: c.prompt, response: c.response, tools: c.toolUses ?? [], cost: c.costUsd, status: c.status }))).turns.slice(0, 60).map((t) => `- ${t.prompt.slice(0, 400)}`),
    prompt("defense.events"),
    ...events.filter((e) => ["paste", "apply-ai", "test-run", "submit"].includes(e.kind)).slice(0, 60).map((e) => `- ${e.kind} ${JSON.stringify(e.data)}`),
  ].join("\n");
  const client = new Anthropic({ apiKey: env.anthropicKey, baseURL: env.anthropicUpstream });
  const response = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    output_config: { effort: "low" },
    system: prompt("defense.system"),
    messages: [{ role: "user", content: summary }],
  } as Anthropic.MessageCreateParamsNonStreaming);
  if (response.stop_reason === "refusal") return;
  const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
  const questions = text.split("\n").map((l) => l.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean).slice(0, 3);
  await db.update(schema.sessions).set({ defenseQuestions: questions }).where(eq(schema.sessions.id, sessionId));
  await audit(admin.email, "report.audit.questions", sessionId);
  revalidatePath(`/sessions/${sessionId}/report`);
}
