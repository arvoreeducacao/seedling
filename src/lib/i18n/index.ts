import { en } from "./en";
import { pt } from "./pt";
import { defaultLocale, isLocale, locales, type Locale, type Params } from "./types";

export { defaultLocale, isLocale, locales };
export type { Locale, Params, Translation } from "./types";

export type Key = keyof typeof en;
export type Dictionary = Record<Key, string>;
export type T = (key: Key, params?: Params) => string;
export type I18n = { locale: Locale; t: T };

export const dictionaries: Record<Locale, Dictionary> = { en, pt };

export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...rest] = part.trim().split(";");
      const quality = rest.map((r) => r.trim()).find((r) => r.startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: quality ? Number(quality.slice(2)) : 1 };
    })
    .filter((entry) => entry.tag && Number.isFinite(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}

export function interpolate(template: string, params?: Params) {
  const forms = template.split("|");
  const chosen = forms.length > 1 ? (Number(params?.n) === 1 ? forms[0] : forms[1]) : template;
  return chosen.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params?.[name];
    return value === undefined ? whole : String(value);
  });
}

export function hasKey(key: string): key is Key {
  return Object.hasOwn(dictionaries[defaultLocale], key);
}

function valueOf(dictionary: Dictionary, key: string) {
  return Object.hasOwn(dictionary, key) ? dictionary[key as Key] : undefined;
}

export function translator(locale: Locale): T {
  const dictionary = dictionaries[locale] ?? dictionaries[defaultLocale];
  return (key, params) => interpolate(valueOf(dictionary, key) ?? valueOf(dictionaries[defaultLocale], key) ?? key, params);
}

export function i18nFor(locale: Locale): I18n {
  return { locale, t: translator(locale) };
}

export class AppError extends Error {
  constructor(
    readonly key: Key,
    readonly params?: Params,
  ) {
    super(key);
  }
}

export function messageOf(error: unknown, t: T, fallback: Key) {
  if (error instanceof AppError) return t(error.key, error.params);
  if (error instanceof Error && hasKey(error.message)) return t(error.message);
  return t(fallback);
}
