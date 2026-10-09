export const STEP_MINUTES = 15;

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes());
}

export function addMonths(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1, date.getHours(), date.getMinutes());
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), last));
  return target;
}

export function sameDay(a: Date | null | undefined, b: Date | null | undefined) {
  return Boolean(a && b) && a!.getFullYear() === b!.getFullYear() && a!.getMonth() === b!.getMonth() && a!.getDate() === b!.getDate();
}

export function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function nextBusinessDay(now = new Date(), hour = 10, minute = 0) {
  let day = addDays(startOfDay(now), 1);
  while (isWeekend(day)) day = addDays(day, 1);
  return withTime(day, hour * 60 + minute);
}

export function withTime(day: Date, minutesOfDay: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutesOfDay / 60), minutesOfDay % 60);
}

export function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function snapMinutes(value: number, step = STEP_MINUTES) {
  const snapped = Math.round(value / step) * step;
  return Math.min(24 * 60 - step, Math.max(0, snapped));
}

export function timeSlots(step = STEP_MINUTES) {
  return Array.from({ length: (24 * 60) / step }, (_, i) => i * step);
}

export function formatSlot(minutes: number, locale = "en-US") {
  return new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

export function monthGrid(month: Date, weekStartsOn = 0) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function toLocalInput(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d, h = "0", min = "0"] = match;
  const year = Number(y);
  const month = Number(m) - 1;
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(min);
  if (month < 0 || month > 11 || hour > 23 || minute > 59) return null;
  const date = new Date(year, month, day, hour, minute);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

export function parseTime(value: string): number | null {
  const match = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*$/i.exec(value);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase().replace(/\./g, "");
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem === "pm" ? 12 : 0);
  } else if (hour > 23) return null;
  return hour * 60 + minute;
}

export function timeZoneLabel(date = new Date(), locale = "en-US") {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const short = new Intl.DateTimeFormat(locale, { timeZoneName: "short" }).formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
  const city = zone?.split("/").pop()?.replace(/_/g, " ") ?? "";
  return city && short ? `${short} · ${city}` : short || zone || "Local time";
}

export function clampDay(day: Date, min: Date | null, max: Date | null) {
  if (min && day < startOfDay(min)) return startOfDay(min);
  if (max && day > startOfDay(max)) return startOfDay(max);
  return day;
}

export function dayDisabled(day: Date, min: Date | null, max: Date | null) {
  return Boolean((min && day < startOfDay(min)) || (max && day > startOfDay(max)));
}
