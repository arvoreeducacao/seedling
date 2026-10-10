"use client";

import { Check } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useI18n } from "@/components/i18n";
import type { Key, T } from "@/lib/i18n";
import type { Step, StepId } from "@/lib/prep/steps";
import prep from "../prep.module.css";

export const stepTitleKeys: Record<StepId, Key> = {
  welcome: "prep.step.welcome",
  read: "prep.step.read",
  setup: "prep.step.setup",
  practice: "prep.step.practice",
  ready: "prep.step.ready",
};

const stepHintKeys: Record<StepId, Key> = {
  welcome: "prep.hint.welcome",
  read: "prep.hint.read",
  setup: "prep.hint.setup",
  practice: "prep.hint.practice",
  ready: "prep.hint.ready",
};

function statusText(t: T, step: Step) {
  if (step.status === "skipped") return t("prep.status.skipped");
  if (step.id === "read") return `${step.done}/${step.total}`;
  if (step.status === "done") return t("prep.status.done");
  return step.optional ? t("prep.status.optional") : "";
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
  const { t } = useI18n();
  return (
    <ol className={prep.vsteps} aria-label={t("prep.steps")} data-el="prep-stepper">
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
                <span className={prep.vstepTitle}>{t(stepTitleKeys[step.id])}</span>
                <span className={prep.vstepHint}>{statusText(t, step) || t(stepHintKeys[step.id])}</span>
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
  const { t } = useI18n();
  const index = steps.findIndex((s) => s.id === active);
  return (
    <div className={prep.hsteps} data-el="prep-progress-rail">
      <ol className={prep.hstepList} aria-label={t("prep.steps")}>
        {steps.map((step, i) => {
          const title = t(stepTitleKeys[step.id]);
          const spoken = step.status === "done" ? t("prep.stepAriaDone", { index: i + 1, title }) : step.status === "skipped" ? t("prep.stepAriaSkipped", { index: i + 1, title }) : t("prep.stepAria", { index: i + 1, title });
          return (
            <li key={step.id} className={prep.hstep} data-state={step.id === active ? "current" : step.status}>
              <button type="button" className={prep.hstepBtn} aria-current={step.id === active ? "step" : undefined} aria-label={spoken} onClick={() => onSelect(step.id)}>
                {step.status === "done" && step.id !== active ? <Check size={11} weight="bold" /> : i + 1}
              </button>
            </li>
          );
        })}
      </ol>
      <div className={prep.hstepLabel}>
        <span className={prep.hstepCount}>{t("prep.stepOf", { current: index + 1, total: steps.length })}</span>
        <span className={prep.hstepName}>{t(stepTitleKeys[active])}</span>
      </div>
    </div>
  );
}
