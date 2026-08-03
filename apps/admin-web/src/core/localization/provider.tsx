"use client";

import { createContext, useContext, useMemo } from "react";
import { directionForLocale, type Direction, type Locale } from "./direction";
import { t } from "./messages";

type LocaleContextValue = {
  direction: Direction;
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const defaultLocaleContext: LocaleContextValue = {
  direction: "rtl",
  locale: "ar",
  setLocale: () => undefined,
};

const LocaleContext = createContext<LocaleContextValue>(defaultLocaleContext);

export function LocaleProvider({
  children,
  locale,
  setLocale,
}: {
  children: React.ReactNode;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}) {
  const value = useMemo(() => ({ direction: directionForLocale(locale), locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

export function useT() {
  const { locale } = useLocale();
  return (key: string, params?: Record<string, string | number>) => t(locale, key, params);
}
