"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { IconAlert, IconCheck, IconCopy } from "@/components/icons";
import { Select } from "@/components/select";
import { Segmented } from "@/components/segmented";
import { DateTimePicker } from "@/components/date-time-picker";
import { useI18n } from "@/components/i18n";
import { dayOnly } from "@/lib/format";
import { isLocale, locales, translator, type Locale } from "@/lib/i18n";
import { inviteMany, type InviteResult } from "../actions";

export type InviteChallenge = { id: string; title: string; level: string; levelLabel: string; kind: "code" | "screen"; minutes: number; runtime: string };
export type InviteSetup = { challengeIds: string[]; minutes: number; budgetUsd: number; model: string; mode: "live" | "async" };

type Props = {
  challenges: InviteChallenge[];
  models: { id: string; label: string }[];
  taken: { email: string; key: string }[];
  mailOn: boolean;
  initial?: InviteSetup;
  box?: { cpus: number; memoryMb: number };
  prepDays?: number;
  adminLocale: Locale;
  orgName: string;
};

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const dateTag: Record<Locale, string> = { en: "en-US", pt: "pt-BR" };

function useReview(text: string, taken: Props["taken"], key: string) {
  return useMemo(() => {
    const seen = new Set<string>();
    return text
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .map((email) => {
        if (seen.has(email)) return { email, state: "dup" as const };
        seen.add(email);
        if (!emailRe.test(email)) return { email, state: "invalid" as const };
        if (key && taken.some((t) => t.email === email && t.key === key)) return { email, state: "taken" as const };
        return { email, state: "ok" as const };
      });
  }, [text, taken, key]);
}

function Done({ links, mailOn }: { links: { email: string; url: string; mailed: boolean }[]; mailOn: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);
  function copy(url: string) {
    void navigator.clipboard.writeText(url);
    setCopied(url);
  }
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--ok-soft)", color: "var(--ok)" }}><IconCheck size={18} /></span>
        <div>
          <h2 className="hero-title" style={{ fontSize: 24 }}>{t("invite.done.title", { n: links.length })}</h2>
          <p className="muted">{mailOn ? t("invite.done.mailed") : t("invite.done.noMail")} {t("invite.done.onceEach")}</p>
        </div>
      </div>
      <div className="card" style={{ marginTop: 24 }}>
        {links.map((l) => (
          <div key={l.url} className="list-item" style={{ minHeight: 60 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>{l.email}{l.mailed && <span className="pill pill-ok">{t("invite.done.emailSent")}</span>}</div>
              <div className="mono faint truncate" style={{ fontSize: 11.5, marginTop: 2 }} data-testid="invite-link">{l.url}</div>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => copy(l.url)}>{copied === l.url ? <><IconCheck size={12} />{t("common.copied")}</> : <><IconCopy size={13} />{t("invite.done.copyLink")}</>}</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <a className="btn" href="/sessions/new">{t("invite.done.more")}</a>
        <Link className="btn btn-ghost" href="/sessions">{t("invite.done.goToSessions")}</Link>
      </div>
    </div>
  );
}

function Review({ review }: { review: ReturnType<typeof useReview> }) {
  const { t } = useI18n();
  const ok = review.filter((r) => r.state === "ok").length;
  const check = review.filter((r) => r.state === "invalid" || r.state === "taken");
  const dups = review.filter((r) => r.state === "dup").length;
  return (
    <div data-el="email-review" style={{ marginTop: 10, border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", gap: 16, fontSize: 12, background: "var(--bg-raised)" }}>
        <span className="muted"><b className="num" style={{ color: "var(--ok)", fontWeight: 500 }}>{ok}</b> {t("invite.review.ready", { n: ok })}</span>
        {check.length > 0 && <span className="muted"><b className="num" style={{ color: "var(--warn)", fontWeight: 500 }}>{check.length}</b> {t("invite.review.skipped", { n: check.length })}</span>}
        {dups > 0 && <span className="faint">{t("invite.review.duplicates", { n: dups })}</span>}
      </div>
      <div className="scroll-thin" style={{ maxHeight: 180, overflowY: "auto" }}>
        {review.filter((r) => r.state !== "dup").map((r) => (
          <div key={r.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", fontSize: 12 }}>
            <span style={{ color: r.state === "ok" ? "var(--ok)" : "var(--warn)", display: "flex" }}>{r.state === "ok" ? <IconCheck size={12} /> : <IconAlert size={13} />}</span>
            <span className="mono truncate" style={{ flex: 1 }}>{r.email}</span>
            {r.state === "invalid" && <span style={{ color: "var(--warn)", whiteSpace: "nowrap" }}>{t("invite.review.invalid")}</span>}
            {r.state === "taken" && <span style={{ color: "var(--warn)", whiteSpace: "nowrap" }}>{t("invite.review.taken")}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailPreview({ locale, orgName, challenges, minutes, mode, expiresAt }: { locale: Locale; orgName: string; challenges: number; minutes: number; mode: "live" | "async"; expiresAt: Date }) {
  const { t } = useI18n();
  const reader = translator(locale);
  const deadline = dayOnly({ locale, t: reader }, expiresAt);
  const scope = reader("mail.invite.scope", {
    n: challenges,
    challenges: reader("common.challenges", { n: challenges }),
    minutes: reader("mail.invite.minutes", { n: minutes }),
  });
  return (
    <div data-el="email-preview" style={{ marginTop: 10, border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden" }}>
      <div className="muted" style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 12, background: "var(--bg-raised)" }}>{t("invite.preview")}</div>
      <div lang={locale} style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, lineHeight: 1.6, color: "var(--text-2)" }}>
        <b style={{ color: "var(--text)" }}>{reader("mail.invite.subject", { org: orgName })}</b>
        <span>{reader("mail.invite.greeting", { org: orgName })}</span>
        <span>{scope}</span>
        <span>{mode === "live" ? reader("mail.invite.howLive") : reader("mail.invite.howAsync")}</span>
        <span>{reader("mail.invite.prep")}</span>
        <span className="pill pill-accent" style={{ alignSelf: "flex-start" }}>{reader("mail.invite.cta")}</span>
        <span className="faint" style={{ fontSize: 11.5 }}>{reader("mail.invite.validity", { deadline })}</span>
      </div>
    </div>
  );
}

function Row({ title, text, children, el }: { title: string; text?: React.ReactNode; children: React.ReactNode; el?: string }) {
  return (
    <div className="form-row" data-el={el}>
      <div className="form-row-label"><b>{title}</b>{text && <span>{text}</span>}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function Arrow({ up }: { up?: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={up ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} /></svg>;
}

function Cross() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}

const levelInk: Record<string, string> = { junior: "var(--ok)", pleno: "var(--accent-text)", senior: "var(--warn)" };

function ChallengePicker({ all, picked, setPicked }: { all: InviteChallenge[]; picked: string[]; setPicked: (ids: string[]) => void }) {
  const { t } = useI18n();
  const rest = all.filter((c) => !picked.includes(c.id));
  const move = (i: number, by: number) => {
    const next = [...picked];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setPicked(next);
  };
  if (!all.length) {
    return <div className="notice notice-warn">{t("invite.noChallenges")} <Link href="/challenges/new" style={{ textDecoration: "underline", color: "var(--text)" }}>{t("invite.uploadOne")}</Link> {t("invite.andPublish")}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {picked.length > 0 && (
        <ol data-el="picked-challenges" style={{ border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden" }}>
          {picked.map((id, i) => {
            const c = all.find((x) => x.id === id);
            if (!c) return null;
            return (
              <li key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px 8px 12px", borderTop: i ? "1px solid var(--border)" : undefined, background: "var(--bg-raised)" }}>
                <input type="hidden" name="challenge" value={id} />
                <span className="step-num">{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="truncate" style={{ fontWeight: 500 }}>{c.title}</div>
                  <div className="faint truncate" style={{ fontSize: 11.5 }}><span style={{ color: levelInk[c.level] }}>{c.levelLabel}</span> · {c.kind === "screen" ? t("invite.kindScreen") : t("kind.code.title")} · {c.runtime} · {c.minutes} {t("common.minutes")}</div>
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t("invite.moveUp", { title: c.title })} disabled={i === 0} onClick={() => move(i, -1)}><Arrow up /></button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t("invite.moveDown", { title: c.title })} disabled={i === picked.length - 1} onClick={() => move(i, 1)}><Arrow /></button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t("invite.removeChallenge", { title: c.title })} onClick={() => setPicked(picked.filter((x) => x !== id))}><Cross /></button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {rest.length > 0 && (
        <Select
          key={picked.join(",")}
          ariaLabel={t("invite.addChallengeAria")}
          placeholder={picked.length ? t("invite.addAnother") : t("invite.chooseChallenge")}
          value=""
          onChange={(id) => setPicked([...picked, id])}
          options={rest.map((c) => ({ value: c.id, label: c.title, text: c.title, hint: `${c.levelLabel} · ${c.minutes} ${t("common.minutes")}` }))}
        />
      )}
    </div>
  );
}

export function InviteForm({ challenges, models, taken, mailOn, initial, box, prepDays = 7, adminLocale, orgName }: Props) {
  const i18n = useI18n();
  const { t } = i18n;
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(inviteMany, null);
  const [picked, setPicked] = useState<string[]>(initial?.challengeIds.filter((id) => challenges.some((c) => c.id === id)) ?? []);
  const [mode, setMode] = useState<"live" | "async">(initial?.mode ?? "live");
  const [text, setText] = useState("");
  const [minutesInput, setMinutesInput] = useState<string | null>(initial ? String(initial.minutes) : null);
  const [budget, setBudget] = useState(String(initial?.budgetUsd ?? 5));
  const [scheduled, setScheduled] = useState<Date | null>(null);
  const [mailLocale, setMailLocale] = useState<Locale>(adminLocale);
  const [limits] = useState(() => ({ min: new Date(), max: new Date(Date.now() + 120 * 86_400_000) }));
  const scheduledIso = scheduled ? scheduled.toISOString() : "";
  const [model, setModel] = useState(initial?.model && models.some((m) => m.id === initial.model) ? initial.model : models[0].id);
  const key = picked.join(",");
  const review = useReview(text, taken, key);
  const ready = review.filter((r) => r.state === "ok").length;
  const suggested = picked.reduce((sum, id) => sum + (challenges.find((c) => c.id === id)?.minutes ?? 0), 0);
  const minutes = minutesInput ?? String(suggested || 60);
  const days = mode === "async" ? 5 : 2;
  const expiresAt = new Date(Math.max(Date.now() + days * 86_400_000, scheduledIso ? new Date(scheduledIso).getTime() + 86_400_000 : 0));
  const expires = expiresAt.toLocaleDateString(dateTag[i18n.locale], { weekday: "short", month: "short", day: "numeric" });
  const budgetNum = Number(budget) || 0;
  const modelLabel = models.find((m) => m.id === model)?.label ?? model;
  const canSend = !pending && ready > 0 && picked.length > 0;

  if (state?.ok) return <Done links={state.links} mailOn={mailOn} />;

  return (
    <form action={action} className="page" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 24, alignItems: "start",  }}>
      <input type="hidden" name="mode" value={mode} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <section className="card">
          <div className="card-head">{t("invite.who")}</div>
          <Row title={t("invite.candidates")} text={t("invite.candidatesHint")} el="emails">
            <textarea className="input mono" name="emails" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("invite.emailsPlaceholder")} data-el="emails-field" aria-label={t("invite.emailsAria")} style={{ fontSize: 12.5 }} />
            {review.length > 0 && <Review review={review} />}
          </Row>
          <Row title={t("invite.language")} text={t("invite.languageHint")} el="invite-language">
            <div style={{ maxWidth: 280 }}>
              <Select
                name="locale"
                value={mailLocale}
                onChange={(next) => {
                  if (isLocale(next)) setMailLocale(next);
                }}
                ariaLabel={t("invite.language")}
                options={locales.map((l) => ({ value: l, label: t(`invite.language.${l}`), text: t(`invite.language.${l}`) }))}
              />
            </div>
            <EmailPreview locale={mailLocale} orgName={orgName} challenges={picked.length} minutes={Number(minutes) || 0} mode={mode} expiresAt={expiresAt} />
          </Row>
        </section>
        <section className="card">
          <div className="card-head">{t("invite.what")}<span className="aside">{picked.length > 0 && <span className="num">{t("common.challenges", { n: picked.length })} · {t("invite.minSuggested", { minutes: suggested })}</span>}</span></div>
          <Row title={t("invite.challenges")} text={t("invite.challengesHint")} el="challenges">
            <ChallengePicker all={challenges} picked={picked} setPicked={setPicked} />
          </Row>
          <Row title={t("invite.format")} text={mode === "live" ? t("invite.formatLiveHint") : t("invite.formatAsyncHint")} el="invite-mode">
            <Segmented ariaLabel={t("invite.format")} value={mode} onChange={setMode} options={[{ value: "live", label: t("invite.modeLive") }, { value: "async", label: t("invite.modeAsync") }]} />
          </Row>
          <Row title={t("invite.interviewDate")} text={<>{t("invite.interviewDateHint", { n: prepDays })} <Link href="/settings/prep" style={{ textDecoration: "underline" }}>{t("invite.editKit")}</Link></>} el="interview-date">
            <DateTimePicker name="scheduledAt" value={scheduled} onChange={setScheduled} min={limits.min} max={limits.max} ariaLabel={t("invite.dateAria")} placeholder={t("invite.notScheduled")} />
          </Row>
          <Row title={t("invite.timeLimit")} text={t("invite.timeLimitHint")}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label className="input input-group" style={{ width: 140 }}>
                <input name="minutes" type="number" inputMode="numeric" min={10} max={600} value={minutes} onChange={(e) => setMinutesInput(e.target.value)} aria-label={t("invite.timeLimitAria")} className="num" />
                <span className="addon">{t("common.minutes")}</span>
              </label>
              {minutesInput !== null && suggested > 0 && Number(minutesInput) !== suggested && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMinutesInput(null)}>{t("invite.useSuggested", { minutes: suggested })}</button>
              )}
            </div>
          </Row>
        </section>
        <section className="card">
          <div className="card-head">{t("invite.aiAccess")}<span className="aside">{t("invite.aiAccessAside")}</span></div>
          <Row title={t("invite.model")} text={t("invite.modelHint")}>
            <div style={{ maxWidth: 280 }}>
              <Select name="model" value={model} onChange={setModel} ariaLabel={t("invite.model")} options={models.map((m) => ({ value: m.id, label: m.label, text: m.label }))} />
            </div>
          </Row>
          <Row title={t("invite.budget")} text={t("invite.budgetHint")}>
            <label className="input input-group" style={{ width: 160 }}>
              <span className="addon">$</span>
              <input name="budget" type="number" inputMode="decimal" step="0.5" min={0.5} max={100} value={budget} onChange={(e) => setBudget(e.target.value)} aria-label={t("invite.budgetAria")} className="num" />
              <span className="addon">USD</span>
            </label>
          </Row>
        </section>
        {state && !state.ok && <div className="notice notice-err" role="alert">{state.error}</div>}
      </div>

      <aside style={{ position: "sticky", top: 72, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card">
          <div className="card-head">{t("invite.summary")}</div>
          <dl style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "10px 16px", fontSize: 12.5 }}>
            {[
              [t("invite.candidates"), ready ? String(ready) : "—"],
              [t("invite.challenges"), picked.length ? String(picked.length) : "—"],
              [t("invite.format"), mode === "live" ? t("invite.live") : t("invite.modeAsync")],
              [t("invite.interview"), scheduledIso ? new Date(scheduledIso).toLocaleString(dateTag[i18n.locale], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : t("invite.whenReady")],
              [t("invite.timeLimit"), `${minutes || "—"} ${t("common.minutes")}`],
              [t("invite.model"), modelLabel],
              [t("invite.language"), t(`invite.language.${mailLocale}`)],
              [t("invite.aiBudget"), t("invite.budgetEach", { amount: budgetNum.toFixed(2) })],
              [t("invite.linkExpires"), expires],
              [t("invite.sandbox"), box ? `${box.cpus} vCPU · ${box.memoryMb >= 1024 ? `${+(box.memoryMb / 1024).toFixed(1)} GB` : `${box.memoryMb} MB`}` : t("invite.sandboxIsolated")],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt className="muted">{k}</dt>
                <dd className="truncate" style={{ textAlign: "right" }}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="card-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            {ready > 1 && <div className="faint" style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}><span>{t("invite.maxSpend")}</span><span className="num" style={{ color: "var(--text-2)" }}>${(ready * budgetNum).toFixed(2)}</span></div>}
            <button className="btn btn-primary btn-lg btn-block" disabled={!canSend} data-el="send-invites">
              {pending ? t("invite.sending") : ready > 1 ? t("invite.sendMany", { n: ready }) : t("invite.sendOne")}
            </button>
            <div className="faint" style={{ fontSize: 11.5, textAlign: "center" }}>{!picked.length ? t("invite.pickChallenge") : !ready ? t("invite.addEmail") : mailOn ? t("invite.oneTimeLink") : t("invite.noMailConfigured")}</div>
          </div>
        </div>
        <div className="notice notice-quiet" style={{ fontSize: 12 }}>
          {t("invite.keyNotice")}
        </div>
      </aside>
    </form>
  );
}
