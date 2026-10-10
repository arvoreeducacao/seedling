import { headers } from "next/headers";
import { i18nFor, pickLocale, type I18n, type Locale } from ".";

export async function getLocale(): Promise<Locale> {
  const h = await headers();
  return pickLocale(h.get("accept-language"));
}

export async function getI18n(): Promise<I18n> {
  return i18nFor(await getLocale());
}

export function i18nFromRequest(req: Request): I18n {
  return i18nFor(pickLocale(req.headers.get("accept-language")));
}
