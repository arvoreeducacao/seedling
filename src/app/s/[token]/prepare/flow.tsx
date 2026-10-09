"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpenText, Check, Flask, HandWaving, LockSimple, Toolbox } from "@phosphor-icons/react";
import ui from "@/components/workspace/ui.module.css";
import { CodeCrystal, Sprout } from "@/components/brand";
import { BringYourSetup } from "@/components/setup/bring-your-setup";
import { buildSteps, completion, firstOpenStep, nextSection, parseStep, settled, stepAfter, stepBefore, type StepId, type StepMark } from "@/lib/prep/steps";
import css from "../landing.module.css";
import prep from "../prep.module.css";
import { prepFetch } from "./client";
import { Countdown, LocalDate } from "./countdown";
import { Practice, practiceUsed, usePracticeStatus, type PracticeOffer } from "./practice";
import { StepperBar, StepperRail, stepTitles } from "./stepper";

export type FlowSection = { id: string; title: string; html: string; links: { title: string; url: string; why: string; host: string }[] };

type Props = {
  token: string;
  first: string;
  kitName: string;
  jobName: string | null;
  welcomeHtml: string;
  sections: FlowSection[];
  bring: boolean;
  practice: PracticeOffer | null;
  initial: { sectionsDone: string[]; stepsDone: string[]; broughtItems: number; practiceUsed: boolean };
  target: string | null;
  expiresAt: string;
  requested: { step: string | null; section: string | null };
};

const dateFormat: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" };

export function PrepFlow(props: Props) {
  const { token, first, sections, bring, practice, target, expiresAt } = props;
  const [sectionsDone, setSectionsDone] = useState(props.initial.sectionsDone);
  const [stepsDone, setStepsDone] = useState(props.initial.stepsDone);
  const [broughtItems, setBroughtItems] = useState(props.initial.broughtItems);
  const [error, setError] = useState<string | null>(null);
  const { status: practiceStatus, refresh: refreshPractice } = usePracticeStatus(token, Boolean(practice));
  const used = practiceStatus ? practiceUsed(practiceStatus) : props.initial.practiceUsed;
  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const steps = useMemo(
    () => buildSteps({ sections: sectionIds, bring, practice: Boolean(practice) }, { sectionsDone, stepsDone, broughtItems, practiceUsed: used }),
    [sectionIds, bring, practice, sectionsDone, stepsDone, broughtItems, used],
  );
  const [active, setActive] = useState<StepId>(() => parseStep(props.requested.step, steps) ?? firstOpenStep(steps));
  const [activeSection, setActiveSection] = useState<string | null>(() => (props.requested.section && sectionIds.includes(props.requested.section) ? props.requested.section : nextSection(sectionIds, props.initial.sectionsDone) ?? sectionIds[0] ?? null));
  const [direction, setDirection] = useState(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const progress = completion(steps);
  const order = steps.map((s) => s.id);

  useEffect(() => {
    if (window.location.hash === "#bring-setup" && bring) setActive("setup");
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("step", active);
    if (active === "read" && activeSection) url.searchParams.set("section", activeSection);
    else url.searchParams.delete("section");
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
    if (moved.current) heading.current?.focus({ preventScroll: true });
  }, [active, activeSection]);

  const go = useCallback(
    (id: StepId) => {
      setDirection(order.indexOf(id) >= order.indexOf(active) ? 1 : -1);
      moved.current = true;
      setActive(id);
      if (window.matchMedia("(max-width: 1040px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [order, active],
  );

  async function mark(markId: StepMark, on = true) {
    const before = stepsDone;
    setError(null);
    setStepsDone((current) => {
      const set = new Set(current);
      const [step, kind] = markId.split("~");
      if (on) {
        set.add(markId);
        set.delete(kind ? step : `${step}~skip`);
      } else set.delete(markId);
      return [...set];
    });
    try {
      const result = await prepFetch<{ stepsDone: string[] }>(token, "steps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mark: markId, on }) });
      setStepsDone(result.stepsDone);
    } catch (e) {
      setStepsDone(before);
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    }
  }

  async function markSection(id: string, done: boolean) {
    const before = sectionsDone;
    setError(null);
    setSectionsDone((current) => (done ? [...new Set([...current, id])] : current.filter((x) => x !== id)));
    try {
      const result = await prepFetch<{ done: string[] }>(token, "sections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sectionId: id, done }) });
      setSectionsDone(result.done);
      return result.done;
    } catch (e) {
      setSectionsDone(before);
      setError(e instanceof Error ? e.message : "Couldn't save that.");
      return null;
    }
  }

  function openSection(id: string) {
    moved.current = true;
    setDirection(sectionIds.indexOf(id) >= sectionIds.indexOf(activeSection ?? "") ? 1 : -1);
    setActiveSection(id);
    if (active !== "read") setActive("read");
  }

  async function doneNext() {
    if (!activeSection) return go(stepAfter(steps, "read"));
    const done = sectionsDone.includes(activeSection) ? sectionsDone : await markSection(activeSection, true);
    if (!done) return;
    const index = sectionIds.indexOf(activeSection);
    const following = sectionIds[index + 1];
    const unread = nextSection(sectionIds, done, activeSection);
    if (following && unread) openSection(following);
    else if (unread) openSection(unread);
    else go(stepAfter(steps, "read"));
  }

  const stepIndex = order.indexOf(active);
  const previous = stepBefore(steps, active);
  const section = sections.find((s) => s.id === activeSection) ?? sections[0];
  const sectionIndex = section ? sectionIds.indexOf(section.id) : -1;
  const when = target ?? expiresAt;

  const countdown = (
    <div className={prep.flowCount} data-el="interview-countdown">
      <div className={prep.flowCountHead}>
        <span className={ui.sectionLabel}>{target ? "Your interview" : "Your link"}</span>
      </div>
      <div className={prep.countWhen}><LocalDate iso={when} options={dateFormat} fallback=" " /></div>
      <Countdown target={when} label={target ? "Starts in" : "Time left to start"} compact />
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className={prep.flow}>
        <aside className={prep.flowSide}>
          <div className={prep.flowSideCard}>
            <div className={prep.flowSideHead}>
              <span className={css.eyebrow}>
                {props.jobName ? <span className={ui.chip}>{props.jobName}</span> : null}
                <span>{props.kitName}</span>
              </span>
              <div className={prep.progressBlock} data-el="prep-progress">
                <div className={prep.progressHead}><span>Your prep</span><span className={ui.mono}>{progress.pct}%</span></div>
                <div className={prep.progressTrack}><motion.span className={prep.progressFill} initial={false} animate={{ width: `${progress.pct}%` }} transition={{ duration: 0.4 }} /></div>
              </div>
            </div>
            <StepperRail steps={steps} active={active} onSelect={go} sections={sections} sectionsDone={sectionsDone} activeSection={activeSection} onSection={openSection} />
          </div>
          {active !== "ready" && <div className={prep.flowSideCount}>{countdown}</div>}
        </aside>

        <div className={prep.flowTop}>
          <StepperBar steps={steps} active={active} onSelect={go} />
          <div className={prep.flowTopMeta}>
            <div className={prep.progressTrack} style={{ flex: 1 }}><motion.span className={prep.progressFill} initial={false} animate={{ width: `${progress.pct}%` }} transition={{ duration: 0.4 }} /></div>
            <span className={ui.mono} style={{ fontSize: 11.5, color: "var(--w-fg-3)" }}>{progress.pct}%</span>
            <span className={prep.flowTopCount}>
              <Countdown target={when} label={target ? "Interview in" : "Link valid for"} compact />
            </span>
          </div>
        </div>

        <main className={prep.flowMain}>
          {error && <div className={prep.error} role="alert" style={{ marginTop: 0, marginBottom: 12 }}>{error}</div>}
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.section
              key={active === "read" ? `read-${section?.id}` : active}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={prep.stepPanel}
              aria-labelledby="prep-step-title"
              data-el={`panel-${active}`}
            >
              <div className={prep.stepKicker}>
                <span>Step {stepIndex + 1} of {order.length}</span>
                {active === "read" && sections.length > 1 && <span className={prep.stepKickerSub}>Read {sectionIndex + 1} of {sections.length}</span>}
                {steps[stepIndex]?.optional && <span className={prep.optionalTag}>Optional</span>}
              </div>

              {active === "welcome" && (
                <>
                  <div className={prep.welcomeHero}>
                    <div style={{ minWidth: 0 }}>
                      <h1 id="prep-step-title" ref={heading} tabIndex={-1} className={css.h1} style={{ marginTop: 10, fontSize: "clamp(30px, 4vw, 44px)" }}>Get ready, {first}.<br /><em>Show us how you work.</em></h1>
                      <p className={css.lead}>This is your prep space. Go through it at your own pace and come back anytime: your progress is saved. Nothing here is graded, and the interview clock only starts when you press Start on the interview page.</p>
                    </div>
                    <div className={prep.welcomeArt} aria-hidden="true">
                      <Sprout mood="waving" size={128} />
                      <span className={prep.welcomeCrystal}><CodeCrystal glyph="braces" hue="mint" tilt={-8} size={48} /></span>
                    </div>
                  </div>
                  {props.welcomeHtml && (
                    <div className={prep.howWeWork} data-el="how-we-work">
                      <div className={ui.sectionLabel}>How we work</div>
                      <div className={prep.md} dangerouslySetInnerHTML={{ __html: props.welcomeHtml }} />
                    </div>
                  )}
                  <ol className={prep.ahead} aria-label="What's ahead">
                    {steps.filter((s) => s.id !== "welcome").map((s) => (
                      <li key={s.id} className={prep.aheadItem}>
                        <span className={prep.aheadIcon}>{stepIcon(s.id)}</span>
                        <span className={prep.aheadText}>
                          <b>{stepTitles[s.id]}</b>
                          <span>{aheadText(s.id, sections.length, practice)}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className={prep.stepActions}>
                    <span />
                    <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${prep.cta}`} onClick={() => { void mark("welcome"); go(stepAfter(steps, "welcome")); }} data-el="welcome-next">
                      {stepsDone.includes("welcome") ? "Continue" : "Let's start"} <ArrowRight size={14} weight="bold" />
                    </button>
                  </div>
                </>
              )}

              {active === "read" && section && (
                <>
                  <div className={prep.readHead}>
                    <h2 id="prep-step-title" ref={heading} tabIndex={-1} className={prep.stepTitle}>{section.title}</h2>
                    {sectionsDone.includes(section.id) && <span className={`${ui.chip} ${ui.chipOk}`} data-el="section-done"><Check size={10} weight="bold" /> Done</span>}
                  </div>
                  {sections.length > 1 && (
                    <div className={prep.readDots} role="group" aria-label="Reads">
                      {sections.map((s, i) => (
                        <button key={s.id} type="button" className={prep.readDot} aria-label={`${i + 1}. ${s.title}${sectionsDone.includes(s.id) ? ", done" : ""}`} aria-current={s.id === section.id ? "true" : undefined} data-done={sectionsDone.includes(s.id) || undefined} onClick={() => openSection(s.id)} />
                      ))}
                    </div>
                  )}
                  {section.html && <div className={prep.md} style={{ maxWidth: 680 }} dangerouslySetInnerHTML={{ __html: section.html }} />}
                  {section.links.length > 0 && (
                    <ul className={prep.links}>
                      {section.links.map((link) => (
                        <li key={link.url}>
                          <a href={link.url} target="_blank" rel="noreferrer noopener" className={prep.link}>
                            <span className={prep.linkHead}>
                              <span className={prep.linkTitle}>{link.title}</span>
                              <span className={prep.linkHost}>{link.host}</span>
                              <ArrowUpRight size={13} className={prep.linkArrow} />
                            </span>
                            {link.why && <span className={prep.linkWhy}>{link.why}</span>}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className={prep.stepActions}>
                    <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => (sectionIndex > 0 ? openSection(sectionIds[sectionIndex - 1]) : go("welcome"))}>
                      <ArrowLeft size={13} /> {sectionIndex > 0 ? "Previous" : "Back"}
                    </button>
                    <span className={prep.stepActionsRight}>
                      {sectionsDone.includes(section.id) && <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnSm}`} onClick={() => void markSection(section.id, false)} data-el="mark-undone">Mark as not done</button>}
                      <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${prep.cta}`} onClick={() => void doneNext()} data-el="done-next">
                        {sectionsDone.includes(section.id) ? "Next" : "Done, next"} <ArrowRight size={14} weight="bold" />
                      </button>
                    </span>
                  </div>
                </>
              )}

              {active === "setup" && (
                <>
                  <h2 id="prep-step-title" ref={heading} tabIndex={-1} className={prep.stepTitle}>Bring your setup</h2>
                  <p className={prep.stepLead}>If you already work with skills, a CLAUDE.md or remote MCP servers, add them here and they will be waiting for you in the sandbox{practice ? ", including in the playground" : ""}. They are installed only in your own sandbox when it starts, and the team can see what you brought. Bringing nothing is completely fine.</p>
                  <div id="bring-setup" data-el="bring-setup">
                    <BringYourSetup token={token} onItems={setBroughtItems} />
                  </div>
                  <div className={prep.footNote} style={{ justifyContent: "flex-start", marginTop: 4 }}>
                    <LockSimple size={13} /> It never runs on our servers.
                  </div>
                  <div className={prep.stepActions}>
                    <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => previous && go(previous)}><ArrowLeft size={13} /> Back</button>
                    <span className={prep.stepActionsRight}>
                      {broughtItems === 0 && <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => { void mark("setup~skip"); go(stepAfter(steps, "setup")); }} data-el="skip-setup">Skip</button>}
                      <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${prep.cta}`} disabled={broughtItems === 0} title={broughtItems === 0 ? "Add something first, or skip" : undefined} onClick={() => { void mark("setup"); go(stepAfter(steps, "setup")); }} data-el="setup-next">
                        Done, next <ArrowRight size={14} weight="bold" />
                      </button>
                    </span>
                  </div>
                </>
              )}

              {active === "practice" && practice && (
                <>
                  <h2 id="prep-step-title" ref={heading} tabIndex={-1} className={prep.stepTitle}>Try the AI</h2>
                  <p className={prep.stepLead}>{practice.mode === "playground" ? "Spend a few minutes with Claude Code in a sandbox like the one you'll use in the interview. Get used to the layout, try a prompt or two, check that your setup works." : "Do a short warm-up challenge in the same sandbox you'll use in the interview, to get used to the layout before the day."} The team only sees whether you practiced, for how long and how many prompts you sent.</p>
                  <Practice token={token} offer={practice} status={practiceStatus} refresh={refreshPractice} />
                  <div className={prep.stepActions}>
                    <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => previous && go(previous)}><ArrowLeft size={13} /> Back</button>
                    <span className={prep.stepActionsRight}>
                      {!used && <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => { void mark("practice~skip"); go("ready"); }} data-el="skip-practice">Skip</button>}
                      <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${prep.cta}`} disabled={!used} title={!used ? "Try it first, or skip" : undefined} onClick={() => { void mark("practice"); go("ready"); }} data-el="practice-next">
                        Next <ArrowRight size={14} weight="bold" />
                      </button>
                    </span>
                  </div>
                </>
              )}

              {active === "ready" && (
                <Ready
                  heading={heading}
                  token={token}
                  first={first}
                  steps={steps}
                  sectionsTotal={sections.length}
                  sectionsRead={sections.filter((s) => sectionsDone.includes(s.id)).length}
                  broughtItems={broughtItems}
                  practice={practice}
                  practiceMinutes={practiceStatus?.minutesUsed ?? 0}
                  practicePrompts={practiceStatus?.prompts ?? 0}
                  practiceRunning={practiceStatus?.status === "running"}
                  target={target}
                  expiresAt={expiresAt}
                  onGo={go}
                />
              )}
            </motion.section>
          </AnimatePresence>
        </main>
      </div>
    </MotionConfig>
  );
}

function stepIcon(id: StepId) {
  if (id === "read") return <BookOpenText size={16} />;
  if (id === "setup") return <Toolbox size={16} />;
  if (id === "practice") return <Flask size={16} />;
  if (id === "ready") return <Check size={16} weight="bold" />;
  return <HandWaving size={16} />;
}

function aheadText(id: StepId, reads: number, practice: PracticeOffer | null) {
  if (id === "read") return `${reads} short read${reads === 1 ? "" : "s"}, one at a time.`;
  if (id === "setup") return "Optional. Skills, CLAUDE.md and MCP servers you already use.";
  if (id === "practice") return practice?.mode === "playground" ? `Optional. A ${practice.minutes} minute playground with Claude Code. Not graded.` : `Optional. A ${practice?.minutes ?? 15} minute warm-up. Doesn't count.`;
  return "The date, a countdown and the way in.";
}

type ReadyProps = {
  heading: React.RefObject<HTMLHeadingElement | null>;
  token: string;
  first: string;
  steps: ReturnType<typeof buildSteps>;
  sectionsTotal: number;
  sectionsRead: number;
  broughtItems: number;
  practice: PracticeOffer | null;
  practiceMinutes: number;
  practicePrompts: number;
  practiceRunning: boolean;
  target: string | null;
  expiresAt: string;
  onGo: (id: StepId) => void;
};

function Ready({ heading, token, first, steps, sectionsTotal, sectionsRead, broughtItems, practice, practiceMinutes, practicePrompts, practiceRunning, target, expiresAt, onGo }: ReadyProps) {
  const open = steps.filter((s) => s.id !== "ready" && !settled(s.status));
  const rows: { id: StepId; label: string; value: string; ok: boolean }[] = [];
  for (const s of steps) {
    if (s.id === "welcome") rows.push({ id: s.id, label: "How we work", value: s.status === "done" ? "Read" : "Not yet", ok: s.status === "done" });
    if (s.id === "read") rows.push({ id: s.id, label: "Reads", value: `${sectionsRead} of ${sectionsTotal}`, ok: s.status === "done" });
    if (s.id === "setup") rows.push({ id: s.id, label: "Your setup", value: broughtItems ? `${broughtItems} item${broughtItems === 1 ? "" : "s"} ready` : s.status === "skipped" ? "Skipped" : "Not yet", ok: settled(s.status) });
    if (s.id === "practice") rows.push({ id: s.id, label: practice?.mode === "playground" ? "Playground" : "Practice run", value: practiceRunning ? "Running now" : s.status === "done" ? `${practiceMinutes} min, ${practicePrompts} prompt${practicePrompts === 1 ? "" : "s"}` : s.status === "skipped" ? "Skipped" : "Not yet", ok: settled(s.status) });
  }
  const when = target ?? expiresAt;
  return (
    <>
      <div className={prep.readyHero}>
        <Sprout mood={open.length ? "idle" : "celebrating"} size={104} label={open.length ? "Sprout" : "Sprout celebrating"} />
        <div style={{ minWidth: 0 }}>
          <h2 id="prep-step-title" ref={heading} tabIndex={-1} className={`${css.display} ${prep.readyTitle}`}>{open.length ? `Almost there, ${first}.` : `You're ready, ${first}.`}</h2>
          <p className={prep.stepLead} style={{ marginTop: 8 }}>{open.length ? `${open.length === 1 ? "One step is" : `${open.length} steps are`} still open. None of it is required, but it helps.` : "That's everything. On the day, open the interview page and press Start when you're ready."}</p>
        </div>
      </div>
      <div className={prep.readyGrid}>
        <ul className={prep.readyList} data-el="ready-summary">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" className={prep.readyRow} onClick={() => onGo(row.id)}>
                <span className={prep.readyMark} data-ok={row.ok || undefined}>{row.ok ? <Check size={11} weight="bold" /> : null}</span>
                <span className={prep.readyLabel}>{row.label}</span>
                <span className={prep.readyValue}>{row.value}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className={prep.readyWhen}>
          <div className={ui.sectionLabel}>{target ? "Your interview" : "Your link"}</div>
          <div className={prep.countWhen} style={{ marginTop: 6 }}>{target ? <LocalDate iso={when} options={dateFormat} fallback=" " /> : <>Valid until <LocalDate iso={when} options={dateFormat} fallback=" " /></>}</div>
          <div style={{ marginTop: 12 }}><Countdown target={when} label={target ? "Starts in" : "Time left to start"} /></div>
          <Link href={`/s/${token}`} className={`${ui.btn} ${ui.btnPrimary} ${prep.readyGo}`} data-el="to-interview">Go to the interview page <ArrowRight size={14} weight="bold" /></Link>
          <div className={ui.faint} style={{ fontSize: 11.5, marginTop: 8, textAlign: "center" }}>The clock starts only when you press Start there.</div>
        </div>
      </div>
    </>
  );
}
