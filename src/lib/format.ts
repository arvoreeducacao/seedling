const timeZone = process.env.NEXT_PUBLIC_SEEDLING_TIMEZONE || undefined;

export const levelLabel = { junior: "Junior", pleno: "Mid", senior: "Senior" } as const;
export const levelPill = { junior: "pill-ok", pleno: "pill-accent", senior: "pill-warn" } as const;

export function money(value: number) {
  return `$${value.toFixed(2)}`;
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

export function when(date: Date | null | undefined) {
  if (!date) return "-";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone });
  if (sameDay) return `today, ${time}`;
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", timeZone });
}

export function relativeDays(date: Date) {
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
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
