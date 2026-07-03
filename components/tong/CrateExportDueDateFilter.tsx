"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DateInputField } from "@/components/shared/DateInputField";
import { useT } from "@/components/shared/locale-context";
import { getBangkokTodayDateInput } from "@/lib/date-utils";
import { resolveCrateExportDueDate } from "@/lib/crate-export-list";
import { resolveDateParam } from "@/lib/inbound-utils";

export function CrateExportDueDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useT();
  const [isPending, startTransition] = useTransition();

  const dueParam = searchParams.get("due");
  const value = dueParam
    ? resolveDateParam(dueParam)
    : resolveCrateExportDueDate();

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-haidee-muted">
        {t("crateExport.dueDateFilterLabel")}
      </label>
      <DateInputField
        value={value}
        disabled={isPending}
        onChange={(next) => {
          const params = new URLSearchParams(searchParams.toString());
          const today = getBangkokTodayDateInput();
          const picked = next && next > today ? today : next;
          if (picked && picked !== today) {
            params.set("due", picked);
          } else {
            params.delete("due");
          }
          startTransition(() => {
            router.push(`/crate/export?${params.toString()}`);
          });
        }}
      />
    </div>
  );
}
