export const stepIds = ["welcome", "read", "setup", "practice", "ready"] as const;
export type StepId = (typeof stepIds)[number];
export type StepStatus = "done" | "skipped" | "partial" | "todo";
export type StepMark = "welcome" | "setup" | "practice" | "setup~skip" | "practice~skip";

export const markable: StepMark[] = ["welcome", "setup", "practice", "setup~skip", "practice~skip"];

export type StepInput = {
  sections: string[];
  bring: boolean;
  practice: boolean;
};

export type StepProgress = {
  sectionsDone: string[];
  stepsDone: string[];
  broughtItems: number;
  practiceUsed: boolean;
};

export type Step = { id: StepId; status: StepStatus; optional: boolean; done: number; total: number };

export function buildSteps(input: StepInput, progress: StepProgress): Step[] {
  const marks = new Set(progress.stepsDone);
  const read = input.sections.filter((id) => progress.sectionsDone.includes(id)).length;
  const steps: Step[] = [{ id: "welcome", status: marks.has("welcome") ? "done" : "todo", optional: false, done: marks.has("welcome") ? 1 : 0, total: 1 }];
  if (input.sections.length) {
    steps.push({ id: "read", status: read === input.sections.length ? "done" : read > 0 ? "partial" : "todo", optional: false, done: read, total: input.sections.length });
  }
  if (input.bring) {
    const done = marks.has("setup") || progress.broughtItems > 0;
    steps.push({ id: "setup", status: done ? "done" : marks.has("setup~skip") ? "skipped" : "todo", optional: true, done: done || marks.has("setup~skip") ? 1 : 0, total: 1 });
  }
  if (input.practice) {
    const done = progress.practiceUsed || marks.has("practice");
    steps.push({ id: "practice", status: done ? "done" : marks.has("practice~skip") ? "skipped" : "todo", optional: true, done: done || marks.has("practice~skip") ? 1 : 0, total: 1 });
  }
  const before = steps.every((s) => settled(s.status));
  steps.push({ id: "ready", status: before ? "done" : "todo", optional: false, done: before ? 1 : 0, total: 1 });
  return steps;
}

export function settled(status: StepStatus) {
  return status === "done" || status === "skipped";
}

export function firstOpenStep(steps: Step[]): StepId {
  return steps.find((s) => !settled(s.status))?.id ?? "ready";
}

export function stepAfter(steps: Step[], id: StepId): StepId {
  const index = steps.findIndex((s) => s.id === id);
  return steps[Math.min(steps.length - 1, index + 1)]?.id ?? "ready";
}

export function stepBefore(steps: Step[], id: StepId): StepId | null {
  const index = steps.findIndex((s) => s.id === id);
  return index > 0 ? steps[index - 1].id : null;
}

export function completion(steps: Step[]) {
  const counted = steps.filter((s) => s.id !== "ready");
  const total = counted.reduce((sum, s) => sum + s.total, 0);
  const done = counted.reduce((sum, s) => sum + s.done, 0);
  return { done, total, pct: total ? Math.round((done / total) * 100) : 100 };
}

export function nextSection(sections: string[], sectionsDone: string[], after?: string): string | null {
  const start = after ? sections.indexOf(after) + 1 : 0;
  const ordered = [...sections.slice(start), ...sections.slice(0, start)];
  return ordered.find((id) => !sectionsDone.includes(id)) ?? null;
}

export function applyMark(stepsDone: string[], mark: StepMark, on: boolean) {
  const set = new Set(stepsDone);
  const [step, kind] = mark.split("~");
  if (on) {
    set.add(mark);
    set.delete(kind ? step : `${step}~skip`);
  } else set.delete(mark);
  return [...set].filter((m) => (markable as string[]).includes(m)).sort();
}

export function parseStep(value: string | null | undefined, steps: Step[]): StepId | null {
  if (!value) return null;
  const hit = steps.find((s) => s.id === value);
  return hit ? hit.id : null;
}
