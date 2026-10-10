import type { I18n, Locale } from "@/lib/i18n";

const timeZone = process.env.NEXT_PUBLIC_SEEDLING_TIMEZONE || undefined;
const bcp47: Record<Locale, string> = { en: "en-US", pt: "pt-BR" };

export function localeTag(locale: Locale) {
  return bcp47[locale];
}

export const levelPill = { junior: "pill-ok", pleno: "pill-accent", senior: "pill-warn" } as const;
export type Level = keyof typeof levelPill;

export function levelLabel({ t }: I18n, level: Level) {
  return t(`level.${level}`);
}

export function challengeTitle({ t }: I18n, title: string | null | undefined) {
  return title?.trim() || t("challenges.untitled");
}

export function money({ locale }: I18n, value: number, digits = 2) {
  return new Intl.NumberFormat(bcp47[locale], { style: "currency", currency: "USD", currencyDisplay: "symbol", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function number({ locale }: I18n, value: number) {
  return new Intl.NumberFormat(bcp47[locale]).format(value);
}

export function clock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function elapsed(from: Date | null | undefined, at: Date) {
  if (!from) return "--:--";
  return clock(at.getTime() - from.getTime());
}

export function time({ locale }: I18n, date: Date) {
  return date.toLocaleTimeString(bcp47[locale], { hour: "2-digit", minute: "2-digit", timeZone });
}

export function when(i18n: I18n, date: Date | null | undefined) {
  if (!date) return i18n.t("common.none");
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return i18n.t("date.todayAt", { time: time(i18n, date) });
  return date.toLocaleDateString(bcp47[i18n.locale], { day: "2-digit", month: "short", timeZone });
}

export function dayAndTime({ locale }: I18n, date: Date) {
  return date.toLocaleDateString(bcp47[locale], { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone });
}

export function dayOnly({ locale }: I18n, date: Date) {
  return date.toLocaleDateString(bcp47[locale], { weekday: "short", day: "2-digit", month: "short", timeZone });
}

export function viewerDateTime({ locale }: I18n, date: Date) {
  return date.toLocaleString(bcp47[locale], { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
}

export function relativeDays({ t }: I18n, date: Date) {
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return t("date.today");
  if (days === 1) return t("date.tomorrow");
  return t("date.inDays", { n: days });
}

export function initials(text: string) {
  const name = text.split("@")[0].replace(/[._-]+/g, " ").trim();
  const parts = name.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

export function displayName(email: string, name?: string | null) {
  if (name) return name;
  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
