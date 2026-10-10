"use client";

import { createContext, useContext, useMemo } from "react";
import { defaultLocale, i18nFor, type I18n, type Locale } from "@/lib/i18n";

const LocaleContext = createContext<Locale>(defaultLocale);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useI18n(): I18n {
  const locale = useContext(LocaleContext);
  return useMemo(() => i18nFor(locale), [locale]);
}
