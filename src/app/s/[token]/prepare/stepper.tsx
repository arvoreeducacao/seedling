"use client";

import { Check } from "@phosphor-icons/react";
import { motion } from "motion/react";
import type { Step, StepId } from "@/lib/prep/steps";
import prep from "../prep.module.css";

export const stepTitles: Record<StepId, string> = {
  welcome: "Welcome",
  read: "Read",
  setup: "Bring your setup",
  practice: "Try the AI",
  ready: "You're ready",
};

const stepHints: Record<StepId, string> = {
  welcome: "How we work",
  read: "Short reads",
  setup: "Skills, CLAUDE.md, MCP",
  practice: "Not graded",
  ready: "Your interview",
};

function statusText(step: Step) {
  if (step.status === "skipped") return "Skipped";
  if (step.id === "read") return `${step.done}/${step.total}`;
  if (step.status === "done") return "Done";
  return step.optional ? "Optional" : "";
}

type Props = {
  steps: Step[];
  active: StepId;
  onSelect: (id: StepId) => void;
  sections: { id: string; title: string }[];
  sectionsDone: string[];
  activeSection: string | null;
  onSection: (id: string) => void;
};

export function StepperRail({ steps, active, onSelect, sections, sectionsDone, activeSection, onSection }: Props) {
  return (
    <ol className={prep.vsteps} aria-label="Prep steps" data-el="prep-stepper">
      {steps.map((step, i) => {
        const current = step.id === active;
        return (
          <li key={step.id} className={prep.vstep} data-state={current ? "current" : step.status}>
            <button type="button" className={prep.vstepBtn} aria-current={current ? "step" : undefined} onClick={() => onSelect(step.id)} data-el={`step-${step.id}`}>
              <span className={prep.vstepDot} aria-hidden="true">
                {current && <motion.span layoutId="prep-step-ring" className={prep.vstepRing} transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                {step.status === "done" ? <Check size={12} weight="bold" /> : <span>{i + 1}</span>}
              </span>
              <span className={prep.vstepText}>
                <span className={prep.vstepTitle}>{stepTitles[step.id]}</span>
                <span className={prep.vstepHint}>{statusText(step) || stepHints[step.id]}</span>
              </span>
            </button>
            {step.id === "read" && current && sections.length > 1 && (
              <ul className={prep.vsubs}>
                {sections.map((section) => {
                  const done = sectionsDone.includes(section.id);
                  return (
                    <li key={section.id}>
                      <button type="button" className={prep.vsub} aria-current={section.id === activeSection ? "true" : undefined} data-done={done || undefined} onClick={() => onSection(section.id)}>
                        <span className={prep.vsubMark} aria-hidden="true">{done ? <Check size={9} weight="bold" /> : null}</span>
                        <span className={prep.vsubTitle}>{section.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function StepperBar({ steps, active, onSelect }: Pick<Props, "steps" | "active" | "onSelect">) {
  const index = steps.findIndex((s) => s.id === active);
  return (
    <div className={prep.hsteps} data-el="prep-progress-rail">
      <ol className={prep.hstepList} aria-label="Prep steps">
        {steps.map((step, i) => (
          <li key={step.id} className={prep.hstep} data-state={step.id === active ? "current" : step.status}>
            <button type="button" className={prep.hstepBtn} aria-current={step.id === active ? "step" : undefined} aria-label={`${i + 1}. ${stepTitles[step.id]}${step.status === "done" ? ", done" : step.status === "skipped" ? ", skipped" : ""}`} onClick={() => onSelect(step.id)}>
              {step.status === "done" && step.id !== active ? <Check size={11} weight="bold" /> : i + 1}
            </button>
          </li>
        ))}
      </ol>
      <div className={prep.hstepLabel}>
        <span className={prep.hstepCount}>Step {index + 1} of {steps.length}</span>
        <span className={prep.hstepName}>{stepTitles[active]}</span>
      </div>
    </div>
  );
}
