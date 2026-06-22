import { getPageErrorMessage } from "@/lib/page-utils";
import type { UserLanguage } from "@/types";

interface PageErrorProps {
  error: unknown;
  locale?: UserLanguage;
}

export function PageError({ error, locale = "zh" }: PageErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-haidee-red/30 bg-red-50 px-4 py-3 text-sm text-haidee-red"
    >
      {getPageErrorMessage(error, locale)}
    </div>
  );
}
