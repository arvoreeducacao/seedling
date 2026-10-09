import { randomBytes } from "node:crypto";
import { z } from "zod";
import { PLAYGROUND_DEFAULTS } from "./playground";

const text = (max: number) => z.string().trim().max(max);
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Links must start with http:// or https://");

export const linkSchema = z.object({
  title: text(160).min(1, "Every link needs a title"),
  url: httpUrl,
  why: text(400).optional().default(""),
});

export const sectionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).optional(),
  title: text(160).min(1, "Every section needs a title"),
  body: text(20_000).optional().default(""),
  links: z.array(linkSchema).max(30).optional().default([]),
});

export const bringSchema = z.object({
  skills: z.boolean().default(true),
  mcpServers: z.boolean().default(true),
  claudeMd: z.boolean().default(true),
});

export const practiceModes = ["off", "playground", "challenge"] as const;
export type PracticeMode = (typeof practiceModes)[number];

export { PLAYGROUND_DEFAULTS };

export const practiceSchema = z.object({
  mode: z.enum(practiceModes).optional(),
  enabled: z.boolean().optional(),
  challengeId: z.string().max(64).nullable().optional().default(null),
  challenge: z.string().max(120).nullable().optional(),
  budgetUsd: z.number().min(0.1).max(20).optional(),
  minutes: z.number().int().min(5).max(120).optional(),
});

export const kitSchema = z.object({
  version: z.literal(1).optional().default(1),
  name: text(120).optional().default(""),
  howWeWork: text(20_000).optional().default(""),
  opensDaysBefore: z.number().int().min(0).max(60).default(7),
  sections: z.array(sectionSchema).max(30).default([]),
  practice: practiceSchema.default({ mode: "playground", challengeId: null }),
  bring: bringSchema.default({ skills: true, mcpServers: true, claudeMd: true }),
});

export type KitLink = z.infer<typeof linkSchema>;
export type KitSection = Omit<z.infer<typeof sectionSchema>, "id"> & { id: string };
export type Kit = Omit<z.infer<typeof kitSchema>, "sections" | "practice"> & {
  sections: KitSection[];
  practice: KitPractice;
};

export type KitPractice = { mode: PracticeMode; enabled: boolean; challengeId: string | null; budgetUsd: number; minutes: number };

export type ChallengeRef = { id: string; slug: string; status: string };

function sectionId() {
  return randomBytes(6).toString("base64url");
}

function describe(error: z.ZodError) {
  const issue = error.issues[0];
  const where = issue.path.length ? ` (${issue.path.join(".")})` : "";
  return `${issue.message}${where}`;
}

export function parseKit(input: unknown, challenges?: ChallengeRef[]): { ok: true; kit: Kit; notes: string[] } | { ok: false; error: string } {
  const result = kitSchema.safeParse(input);
  if (!result.success) return { ok: false, error: describe(result.error) };
  const raw = result.data;
  const notes: string[] = [];
  const seen = new Set<string>();
  const sections = raw.sections.map((s) => {
    let id = s.id && !seen.has(s.id) ? s.id : sectionId();
    while (seen.has(id)) id = sectionId();
    seen.add(id);
    return { id, title: s.title, body: s.body, links: s.links.map((l) => ({ title: l.title, url: l.url, why: l.why ?? "" })) };
  });
  const practice = resolvePractice(raw.practice, challenges, notes);
  return {
    ok: true,
    notes,
    kit: {
      version: 1,
      name: raw.name,
      howWeWork: raw.howWeWork,
      opensDaysBefore: raw.opensDaysBefore,
      sections,
      practice,
      bring: raw.bring,
    },
  };
}

function resolvePractice(raw: z.infer<typeof practiceSchema>, challenges: ChallengeRef[] | undefined, notes: string[]): KitPractice {
  const requested: PracticeMode = raw.mode ?? (raw.enabled === false ? "off" : raw.enabled && (raw.challengeId || raw.challenge) ? "challenge" : "playground");
  const limits = (fallback: { budgetUsd: number; minutes: number }) => ({ budgetUsd: raw.budgetUsd ?? fallback.budgetUsd, minutes: raw.minutes ?? fallback.minutes });
  const published = (challenges ?? []).filter((c) => c.status === "published");
  let challengeId = raw.challengeId ?? null;
  if (challenges && challengeId && !published.some((c) => c.id === challengeId)) challengeId = null;
  if (!challengeId && raw.challenge) challengeId = published.find((c) => c.slug === raw.challenge || c.id === raw.challenge)?.id ?? null;
  if (requested === "off") return { mode: "off", enabled: false, challengeId, ...limits(PLAYGROUND_DEFAULTS) };
  if (requested === "challenge") {
    if (challengeId) return { mode: "challenge", enabled: true, challengeId, ...limits({ budgetUsd: 1, minutes: 15 }) };
    notes.push(raw.challenge ? `The practice challenge "${raw.challenge}" isn't published in this workspace, so candidates get the playground instead.` : "No practice challenge picked, so candidates get the playground instead.");
  }
  return { mode: "playground", enabled: true, challengeId: null, ...limits(PLAYGROUND_DEFAULTS) };
}

export function exportKit(kit: Kit, challenges: ChallengeRef[] = []) {
  const slug = kit.practice.challengeId ? (challenges.find((c) => c.id === kit.practice.challengeId)?.slug ?? null) : null;
  return {
    version: 1 as const,
    name: kit.name,
    howWeWork: kit.howWeWork,
    opensDaysBefore: kit.opensDaysBefore,
    sections: kit.sections.map((s) => ({ title: s.title, body: s.body, links: s.links.map((l) => (l.why ? l : { title: l.title, url: l.url })) })),
    practice: { mode: kit.practice.mode, enabled: kit.practice.enabled, challenge: kit.practice.mode === "challenge" ? slug : null, budgetUsd: kit.practice.budgetUsd, minutes: kit.practice.minutes },
    bring: kit.bring,
  };
}

export function kitIsEmpty(kit: Kit) {
  return !kit.howWeWork.trim() && !kit.sections.length && !kit.practice.enabled;
}

export function prepOpensAt(kit: Kit, scheduledAt: Date | null) {
  if (!scheduledAt) return null;
  return new Date(scheduledAt.getTime() - kit.opensDaysBefore * 86_400_000);
}

export const defaultKit: Kit = {
  version: 1,
  name: "Interview prep",
  opensDaysBefore: 7,
  howWeWork: [
    "We build software with AI agents in the loop, every day. The interview works the same way: you get a real codebase, a sandbox with Claude Code already running, and a problem worth solving.",
    "",
    "What we look for:",
    "- **Framing.** Do you understand the problem before asking the agent to change anything?",
    "- **Steering.** Do you give the agent context, split the work, and push back when it drifts?",
    "- **Verifying.** Do you read the diff, run the tests and catch what the agent got wrong?",
    "",
    "Typing speed doesn't matter. Judgment does.",
  ].join("\n"),
  sections: [
    {
      id: "format",
      title: "How the interview works",
      body: [
        "You open your invite link, press Start, and a private sandbox opens in your browser with a terminal, the files and Claude Code. The clock starts at that moment.",
        "",
        "- One or more challenges, shown one at a time.",
        "- A fixed AI budget for the whole session. When it runs out, the agent stops but everything else keeps working.",
        "- The terminal, your files and your prompts are recorded so the team can review them with you afterwards.",
      ].join("\n"),
      links: [],
    },
    {
      id: "claude-code",
      title: "Get comfortable with Claude Code",
      body: "If you haven't used Claude Code much, spend an hour with it before the day. Plan mode, CLAUDE.md, subagents and reading diffs will all come up.",
      links: [
        { title: "Claude Code overview", url: "https://docs.claude.com/en/docs/claude-code/overview", why: "The official docs: what the agent can do and how to steer it from the terminal." },
        { title: "Claude Code courses", url: "https://academy.claude.com/products/code", why: "Short free courses that cover the workflow you'll use in the sandbox." },
      ],
    },
  ],
  practice: { mode: "playground", enabled: true, challengeId: null, ...PLAYGROUND_DEFAULTS },
  bring: { skills: true, mcpServers: true, claudeMd: true },
};
