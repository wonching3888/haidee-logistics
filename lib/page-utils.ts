import { t } from "@/lib/i18n/translate";
import type { UserLanguage } from "@/types";

export function getPageErrorMessage(
  error: unknown,
  locale: UserLanguage = "zh"
): string {
  if (error instanceof Error) return error.message;
  return t("error.loadFailed", locale);
}
