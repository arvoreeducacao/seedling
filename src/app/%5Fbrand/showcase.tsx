"use client";

import { useState, type ReactNode } from "react";
import {
  AgentBuddy,
  agentStates,
  CodeCrystal,
  Logo,
  crystalGlyphs,
  crystalHues,
  Sprout,
  sproutMoods,
  Stage,
  Stopwatch,
  type AgentState,
  type SproutMood,
} from "@/components/brand";

const palette = {
  page: "#0e0f2d",
  surface: "#13143a",
  raised: "#1a1c44",
  high: "#202352",
  muted: "#babcd9",
  accent: "#5865f2",
};

const display = { fontFamily: "var(--font-display), var(--font-geist-sans), sans-serif", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "-0.01em" };

const moodUse: Record<SproutMood, string> = {
  idle: "Default presence on cards and the sidebar",
  waving: "Login and the candidate landing",
  thinking: "While the agent works or a page loads",
  celebrating: "Submission done, end page",
  sleeping: "Empty states: no sessions, no challenges",
  worried: "Errors, expired links, out of budget",
};

const agentUse: Record<AgentState, string> = {
  idle: "Agent panel at rest",
  working: "Streaming a reply",
  done: "Turn finished",
  error: "Gateway refused or failed",
};

function Section({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 24 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <span style={{ color: palette.muted, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>{kicker}</span>
        <h2 style={{ ...display, fontSize: 28, color: "#fff", margin: 0 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Tile({ children, caption, note }: { children: ReactNode; caption: string; note?: string }) {
  return (
    <div style={{ background: palette.surface, borderRadius: 24, padding: 24, display: "grid", justifyItems: "center", gap: 16, minHeight: 260, alignContent: "space-between" }}>
      <div style={{ display: "grid", placeItems: "center", flex: 1, minHeight: 180 }}>{children}</div>
      <div style={{ textAlign: "center", display: "grid", gap: 4 }}>
        <code style={{ color: "#fff", fontSize: 13, fontFamily: "var(--font-geist-mono), monospace" }}>{caption}</code>
        {note && <span style={{ color: palette.muted, fontSize: 13 }}>{note}</span>}
      </div>
    </div>
  );
}

function Picker<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 12,
              border: 0,
              cursor: "pointer",
              fontSize: 14,
              color: active ? "#fff" : palette.muted,
              background: active ? palette.high : palette.raised,
              outline: active ? `1px solid rgba(255,255,255,0.14)` : "none",
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function BrandShowcase() {
  const [mood, setMood] = useState<SproutMood>("waving");
  const [agent, setAgent] = useState<AgentState>("working");
  const [progress, setProgress] = useState(0.62);

  return (
    <main style={{ background: palette.page, color: palette.muted, minHeight: "100vh", overflowX: "clip", fontFamily: "var(--font-geist-sans), sans-serif" }}>
      <Stage starfield style={{ padding: "96px 16px 160px", overflow: "hidden" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 40, justifyItems: "center", textAlign: "center" }}>
          <h1 style={{ ...display, fontSize: "clamp(36px, 6vw, 72px)", lineHeight: 1.02, color: "#fff", margin: 0 }}>
            Meet the cast
          </h1>
          <p style={{ maxWidth: 560, fontSize: 18, lineHeight: 1.55, margin: 0 }}>
            Sprout and friends live in <code style={{ color: "#fff" }}>@/components/brand</code>. Drop them at the edge of a card and let them overlap.
          </p>
          <Stage style={{ width: "min(560px, 100%)", marginTop: 72 }}>
            <Stage.Actor at="top-right" out={0.78} inset={36}>
              <Sprout mood="waving" size={150} />
            </Stage.Actor>
            <Stage.Actor at="left" out={0.6} behind delay={0.35}>
              <CodeCrystal glyph="angle" hue="mint" size={64} tilt={-12} />
            </Stage.Actor>
            <Stage.Actor at="bottom-left" out={0.55} inset={-20} delay={0.5}>
              <AgentBuddy state="idle" size={110} />
            </Stage.Actor>
            <div style={{ background: palette.surface, borderRadius: 24, padding: "40px 32px", display: "grid", gap: 20, textAlign: "left" }}>
              <h3 style={{ ...display, fontSize: 22, color: "#fff", margin: 0 }}>Welcome back</h3>
              <p style={{ margin: 0, lineHeight: 1.5 }}>A sample card. Sprout sits on its top edge, the agent peeks from below, a crystal hides behind.</p>
              <button type="button" style={{ height: 48, borderRadius: 16, border: 0, background: palette.accent, color: "#fff", fontSize: 16, fontWeight: 600 }}>
                Continue with Google
              </button>
            </div>
          </Stage>
        </div>
        <div style={{ position: "absolute", right: "8%", top: 120 }}>
          <CodeCrystal glyph="braces" hue="violet" size={72} tilt={10} delay={0.2} />
        </div>
        <div style={{ position: "absolute", left: "6%", top: 48 }}>
          <CodeCrystal glyph="brackets" hue="pink" size={52} tilt={-8} delay={0.3} />
        </div>
      </Stage>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 16px 120px", display: "grid", gap: 96 }}>
        <Section kicker="Identity" title="The logo">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <Tile caption={`<Logo size={56} />`} note="Default lockup on indigo">
              <Logo size={56} />
            </Tile>
            <Tile caption={`<Logo variant="mark" size={96} />`} note="App icon, avatar, favicon source">
              <Logo variant="mark" size={96} />
            </Tile>
            <Tile caption={`<Logo tone="dark" />`} note="On light surfaces">
              <div style={{ background: "#eef0ff", borderRadius: 16, padding: "20px 24px" }}>
                <Logo size={40} tone="dark" />
              </div>
            </Tile>
          </div>
          <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
            <Logo size={20} />
            <Logo size={28} />
            <Logo variant="mark" size={16} />
            <Logo variant="mark" size={24} />
            <Logo variant="wordmark" size={28} />
            <Logo variant="wordmark" size={64} />
          </div>
        </Section>

        <Section kicker="Mascot" title="Sprout, six moods">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {sproutMoods.map((m, i) => (
              <Tile key={m} caption={`<Sprout mood="${m}" />`} note={moodUse[m]}>
                <Sprout mood={m} size={150} delay={i * 0.06} />
              </Tile>
            ))}
          </div>
        </Section>

        <Section kicker="Transitions" title="Moods morph in place">
          <div style={{ background: palette.surface, borderRadius: 24, padding: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32, alignItems: "center" }}>
            <div style={{ display: "grid", gap: 20, justifyItems: "center" }}>
              <Sprout mood={mood} size={220} />
              <Picker options={sproutMoods} value={mood} onChange={setMood} />
            </div>
            <div style={{ display: "grid", gap: 20, justifyItems: "center" }}>
              <AgentBuddy state={agent} size={200} />
              <Picker options={agentStates} value={agent} onChange={setAgent} />
            </div>
          </div>
        </Section>

        <Section kicker="Supporting cast" title="The agent buddy">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {agentStates.map((s) => (
              <Tile key={s} caption={`<AgentBuddy state="${s}" />`} note={agentUse[s]}>
                <AgentBuddy state={s} size={140} />
              </Tile>
            ))}
          </div>
        </Section>

        <Section kicker="Props" title="Code crystals">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {crystalHues.map((hue, i) => {
              const glyph = crystalGlyphs[i % crystalGlyphs.length];
              return (
                <Tile key={hue} caption={`hue="${hue}" glyph="${glyph}"`}>
                  <CodeCrystal hue={hue} glyph={glyph} size={84} tilt={i % 2 ? 8 : -8} />
                </Tile>
              );
            })}
          </div>
        </Section>

        <Section kicker="Props" title="The stopwatch">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            <Tile caption={`progress={${progress.toFixed(2)}}`} note="Drag to see the ring shift color">
              <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
                <Stopwatch progress={progress} size={110} />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={progress}
                  aria-label="Time remaining"
                  onChange={(event) => setProgress(Number(event.target.value))}
                  style={{ accentColor: palette.accent, width: 140 }}
                />
              </div>
            </Tile>
            <Tile caption="running={false}" note="Paused or not started">
              <Stopwatch progress={1} running={false} size={110} />
            </Tile>
            <Tile caption="progress={0.2}" note="Last stretch">
              <Stopwatch progress={0.2} size={110} />
            </Tile>
            <Tile caption="urgent" note="Final minutes, gentle rattle">
              <Stopwatch progress={0.06} urgent size={110} />
            </Tile>
          </div>
        </Section>

        <Section kicker="Scenes" title="Characters on card edges">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 48, paddingTop: 64 }}>
            <Stage>
              <Stage.Actor at="top" out={0.7}>
                <Sprout mood="sleeping" size={120} />
              </Stage.Actor>
              <div style={{ background: palette.surface, borderRadius: 24, padding: "64px 24px 32px", textAlign: "center", display: "grid", gap: 8 }}>
                <h3 style={{ ...display, fontSize: 18, color: "#fff", margin: 0 }}>No sessions yet</h3>
                <p style={{ margin: 0 }}>Empty state with Sprout asleep on the top edge.</p>
              </div>
            </Stage>
            <Stage>
              <Stage.Actor at="top-left" out={0.7}>
                <Sprout mood="worried" size={120} />
              </Stage.Actor>
              <Stage.Actor at="right" out={0.5} delay={0.3}>
                <Stopwatch progress={0} urgent running={false} size={72} />
              </Stage.Actor>
              <div style={{ background: palette.surface, borderRadius: 24, padding: "64px 24px 32px", display: "grid", gap: 8 }}>
                <h3 style={{ ...display, fontSize: 18, color: "#fff", margin: 0 }}>This link expired</h3>
                <p style={{ margin: 0 }}>Error state with a worried Sprout and a spent stopwatch.</p>
              </div>
            </Stage>
            <Stage>
              <Stage.Actor at="top-right" out={0.75}>
                <Sprout mood="celebrating" size={130} />
              </Stage.Actor>
              <Stage.Actor at="bottom-left" out={0.5} delay={0.3}>
                <CodeCrystal glyph="braces" hue="amber" size={56} />
              </Stage.Actor>
              <div style={{ background: palette.surface, borderRadius: 24, padding: "64px 24px 32px", display: "grid", gap: 8 }}>
                <h3 style={{ ...display, fontSize: 18, color: "#fff", margin: 0 }}>Submitted</h3>
                <p style={{ margin: 0 }}>End page with a celebrating Sprout.</p>
              </div>
            </Stage>
          </div>
        </Section>
      </div>
    </main>
  );
}
