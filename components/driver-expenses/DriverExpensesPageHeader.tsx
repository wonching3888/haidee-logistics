"use client";

import { useT } from "@/components/shared/locale-context";

export function DriverExpensesPageHeader() {
  const { t } = useT();

  return (
    <div>
      <h2 className="text-2xl font-bold text-haidee-text">
        {t("driverExpenses.page.title")}
      </h2>
      <p className="text-sm text-haidee-muted">
        {t("driverExpenses.page.subtitle")}
      </p>
    </div>
  );
}
