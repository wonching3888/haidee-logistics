"use client";

import { useT } from "@/components/shared/locale-context";
import type { MessageKey } from "@/lib/i18n/messages";

export function ThaiCostPageHeader({
  titleKey,
  subtitleKey,
}: {
  titleKey: MessageKey;
  subtitleKey?: MessageKey;
}) {
  const { tLocal } = useT();

  return (
    <div>
      <h2 className="text-2xl font-bold">{tLocal(titleKey)}</h2>
      {subtitleKey && (
        <p className="text-sm text-haidee-muted">{tLocal(subtitleKey)}</p>
      )}
    </div>
  );
}

export function ThaiCostSectionTitle({ titleKey }: { titleKey: MessageKey }) {
  const { tLocal } = useT();
  return <h3 className="text-lg font-semibold">{tLocal(titleKey)}</h3>;
}
