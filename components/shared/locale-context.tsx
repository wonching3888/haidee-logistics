"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { getMessageParts, t as translate, tLocal as translateLocal } from "@/lib/i18n/translate";
import type { MessageKey } from "@/lib/i18n/messages";
import type { UserLanguage } from "@/types";

const LocaleContext = createContext<UserLanguage>("zh");

export function LocaleProvider({
  language,
  children,
}: {
  language: UserLanguage;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={language}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): UserLanguage {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useLocale();

  const t = useCallback(
    (key: MessageKey) => translate(key, locale),
    [locale]
  );

  const parts = useCallback(
    (key: MessageKey) => getMessageParts(key, locale),
    [locale]
  );

  const tLocal = useCallback(
    (key: MessageKey, vars?: Record<string, string>) =>
      translateLocal(key, locale, vars),
    [locale]
  );

  return useMemo(() => ({ t, parts, tLocal, locale }), [t, parts, tLocal, locale]);
}
