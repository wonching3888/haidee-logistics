"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { getMessageParts, t as translate } from "@/lib/i18n/translate";
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

  return useMemo(() => ({ t, parts, locale }), [t, parts, locale]);
}
