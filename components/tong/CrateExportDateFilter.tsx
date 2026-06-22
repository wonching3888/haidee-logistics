"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DateInputField } from "@/components/shared/DateInputField";
import { useT } from "@/components/shared/locale-context";
import {
  getDefaultInboundDate,
  resolveDateParam,
  toDateInputValue,
} from "@/lib/inbound-utils";

export function CrateExportDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useT();
  const [isPending, startTransition] = useTransition();

  const dateParam = searchParams.get("date");
  const value = dateParam
    ? resolveDateParam(dateParam)
    : toDateInputValue(getDefaultInboundDate());

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-haidee-border bg-white p-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-haidee-muted">
          {t("common.date")}
        </label>
        <DateInputField
          value={value}
          disabled={isPending}
          onChange={(next) => {
            const params = new URLSearchParams(searchParams.toString());
            if (next) {
              params.set("date", next);
            } else {
              params.delete("date");
            }
            startTransition(() => {
              router.push(`/crate/export?${params.toString()}`);
            });
          }}
        />
      </div>
    </div>
  );
}
