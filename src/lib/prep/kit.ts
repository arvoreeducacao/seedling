import { randomBytes } from "node:crypto";
import { z } from "zod";
import { defaultLocale, hasKey, type I18n, type Locale, type Params } from "@/lib/i18n";
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
  }, "kit.error.linkUrl");

export const linkSchema = z.object({
  title: text(160).min(1, "kit.error.linkTitle"),
  url: httpUrl,
  why: text(400).optional().default(""),
});

export const sectionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).optional(),
  title: text(160).min(1, "kit.error.sectionTitle"),
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

export type KitProblem = { error: string; at: string };
export type KitNote = { key: string; params?: Params };

function describe(error: z.ZodError): KitProblem {
  const issue = error.issues[0];
  return { error: issue.message, at: issue.path.join(".") };
}

export function kitProblemText({ t }: I18n, problem: KitProblem) {
  const message = hasKey(problem.error) ? t(problem.error) : problem.error;
  return problem.at ? `${message} (${problem.at})` : message;
}

export function kitNoteText({ t }: I18n, note: KitNote) {
  return hasKey(note.key) ? t(note.key, note.params) : note.key;
}

export function parseKit(input: unknown, challenges?: ChallengeRef[]): { ok: true; kit: Kit; notes: KitNote[] } | ({ ok: false } & KitProblem) {
  const result = kitSchema.safeParse(input);
  if (!result.success) return { ok: false, ...describe(result.error) };
  const raw = result.data;
  const notes: KitNote[] = [];
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

function resolvePractice(raw: z.infer<typeof practiceSchema>, challenges: ChallengeRef[] | undefined, notes: KitNote[]): KitPractice {
  const requested: PracticeMode = raw.mode ?? (raw.enabled === false ? "off" : raw.enabled && (raw.challengeId || raw.challenge) ? "challenge" : "playground");
  const limits = (fallback: { budgetUsd: number; minutes: number }) => ({ budgetUsd: raw.budgetUsd ?? fallback.budgetUsd, minutes: raw.minutes ?? fallback.minutes });
  const published = (challenges ?? []).filter((c) => c.status === "published");
  let challengeId = raw.challengeId ?? null;
  if (challenges && challengeId && !published.some((c) => c.id === challengeId)) challengeId = null;
  if (!challengeId && raw.challenge) challengeId = published.find((c) => c.slug === raw.challenge || c.id === raw.challenge)?.id ?? null;
  if (requested === "off") return { mode: "off", enabled: false, challengeId, ...limits(PLAYGROUND_DEFAULTS) };
  if (requested === "challenge") {
    if (challengeId) return { mode: "challenge", enabled: true, challengeId, ...limits({ budgetUsd: 1, minutes: 15 }) };
    notes.push(raw.challenge ? { key: "kit.note.playgroundForUnpublished", params: { challenge: raw.challenge } } : { key: "kit.note.playgroundForNoPick" });
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

const defaultKits: Record<Locale, Kit> = {
  en: {
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
  },
  pt: {
    version: 1,
    name: "Preparação para a entrevista",
    opensDaysBefore: 7,
    howWeWork: [
      "Construímos software com agentes de IA no circuito, todo dia. A entrevista funciona do mesmo jeito: você recebe um código de verdade, um sandbox com o Claude Code já rodando e um problema que vale resolver.",
      "",
      "O que a gente olha:",
      "- **Enquadrar.** Você entende o problema antes de pedir qualquer mudança ao agente?",
      "- **Conduzir.** Você dá contexto ao agente, divide o trabalho e o corrige quando ele sai do rumo?",
      "- **Verificar.** Você lê o diff, roda os testes e pega o que o agente errou?",
      "",
      "Velocidade de digitação não importa. Critério importa.",
    ].join("\n"),
    sections: [
      {
        id: "format",
        title: "Como funciona a entrevista",
        body: [
          "Você abre o link do convite, aperta Começar e um sandbox privado abre no seu navegador, com terminal, os arquivos e o Claude Code. O relógio começa nesse momento.",
          "",
          "- Um ou mais desafios, mostrados um por vez.",
          "- Um teto fixo de IA para a sessão inteira. Quando ele acaba, o agente para e o resto continua funcionando.",
          "- O terminal, seus arquivos e seus prompts ficam gravados, para o time avaliar com você depois.",
        ].join("\n"),
        links: [],
      },
      {
        id: "claude-code",
        title: "Fique à vontade com o Claude Code",
        body: "Se você usa pouco o Claude Code, passe uma hora com ele antes do dia. Modo de plano, CLAUDE.md, subagentes e leitura de diff vão aparecer.",
        links: [
          { title: "Visão geral do Claude Code", url: "https://docs.claude.com/en/docs/claude-code/overview", why: "A documentação oficial: o que o agente faz e como conduzi-lo pelo terminal." },
          { title: "Cursos de Claude Code", url: "https://academy.claude.com/products/code", why: "Cursos curtos e gratuitos que cobrem o fluxo que você vai usar no sandbox." },
        ],
      },
    ],
    practice: { mode: "playground", enabled: true, challengeId: null, ...PLAYGROUND_DEFAULTS },
    bring: { skills: true, mcpServers: true, claudeMd: true },
  },
};

export const defaultKit: Kit = defaultKits[defaultLocale];

export function defaultKitFor(locale: Locale): Kit {
  return defaultKits[locale] ?? defaultKits[defaultLocale];
}
