"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { CharterInvoicePicker } from "@/components/documents/CharterInvoicePicker";
import { MonthlyInvoicePicker } from "@/components/documents/MonthlyInvoicePicker";
import { ReportFilterBar } from "@/components/shared/ReportFilterBar";
import { YearMonthFields } from "@/components/shared/YearMonthFields";
import {
  isValidListMonth,
  isValidListYear,
  parseYearMonthFromSearchParams,
} from "@/lib/parse-year-month-params";

type InvoiceHubTab = "dispatch" | "charter";

function resolveTab(raw: string | null): InvoiceHubTab {
  return raw === "charter" ? "charter" : "dispatch";
}

interface InvoiceHubTabsProps {
  listHref?: string;
}

export function InvoiceHubTabs({ listHref }: InvoiceHubTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = resolveTab(searchParams.get("tab"));

  const urlYearMonth = useMemo(
    () => parseYearMonthFromSearchParams(searchParams),
    [searchParams]
  );
  const [monthDraft, setMonthDraft] = useState(urlYearMonth);

  useEffect(() => {
    setMonthDraft(urlYearMonth);
  }, [urlYearMonth]);

  const applySharedMonth = useCallback(() => {
    if (!isValidListYear(monthDraft.year) || !isValidListMonth(monthDraft.month)) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(monthDraft.year));
    params.set("month", String(monthDraft.month));
    if (activeTab === "charter") {
      params.set("tab", "charter");
    }
    router.push(`/documents/monthly-invoice?${params.toString()}`);
  }, [activeTab, monthDraft.month, monthDraft.year, router, searchParams]);

  function switchTab(tab: InvoiceHubTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(urlYearMonth.year));
    params.set("month", String(urlYearMonth.month));
    if (tab === "charter") {
      params.set("tab", "charter");
    } else {
      params.delete("tab");
    }
    router.push(`/documents/monthly-invoice?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <ReportFilterBar onSearch={applySharedMonth}>
        <YearMonthFields
          year={monthDraft.year}
          month={monthDraft.month}
          onYearChange={(year) => setMonthDraft((prev) => ({ ...prev, year }))}
          onMonthChange={(month) => setMonthDraft((prev) => ({ ...prev, month }))}
          monthSuffix=""
        />
      </ReportFilterBar>

      <div
        className="flex flex-wrap gap-2 border-b border-haidee-border pb-3"
        role="tablist"
        aria-label="账单类型 Invoice type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "dispatch"}
          onClick={() => switchTab("dispatch")}
          className={cn(
            "min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "dispatch"
              ? "border-haidee-blue bg-haidee-blue/10 text-haidee-blue"
              : "border-haidee-border bg-white text-haidee-text hover:bg-haidee-surface/60"
          )}
        >
          派车账单 Dispatch Invoices
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "charter"}
          onClick={() => switchTab("charter")}
          className={cn(
            "min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "charter"
              ? "border-haidee-blue bg-haidee-blue/10 text-haidee-blue"
              : "border-haidee-border bg-white text-haidee-text hover:bg-haidee-surface/60"
          )}
        >
          包车发票 Charter Invoice
        </button>
      </div>

      {activeTab === "dispatch" ? (
        <MonthlyInvoicePicker listHref={listHref} sharedYearMonth />
      ) : (
        <CharterInvoicePicker sharedYearMonth />
      )}
    </div>
  );
}
