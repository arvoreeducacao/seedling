export const locales = ["en", "pt"] as const;

export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export type Params = Record<string, string | number>;
export type Translation<T> = Record<keyof T, string>;

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}
