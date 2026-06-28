"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLocale } from "@/components/shared/locale-context";
import type {
  OperationsPayrollWarningResult,
  PayrollWarningRuleKey,
  PayrollWarningSample,
} from "@/lib/operations-payroll-warnings";
import { MESSAGES, type MessageKey } from "@/lib/i18n/messages";
import { tLocal } from "@/lib/i18n/translate";

const RULE_MESSAGE_KEYS: Record<PayrollWarningRuleKey, MessageKey> = {
  p1: "operations.payrollWarning.p1",
  p2: "operations.payrollWarning.p2",
  p3: "operations.payrollWarning.p3",
  p4: "operations.payrollWarning.p4",
  p5: "operations.payrollWarning.p5",
  d5: "operations.payrollWarning.d5",
};

function severityClass(severity: "high" | "medium") {
  return severity === "high"
    ? "text-red-800 font-semibold"
    : "text-amber-900 font-medium";
}

function formatSample(sample: PayrollWarningSample) {
  const parts = [
    sample.driverName,
    sample.date,
    sample.tripNo ? `#${sample.tripNo}` : null,
    sample.plate,
    sample.expectedAmount != null && sample.actualAmount != null
      ? `${sample.actualAmount}/${sample.expectedAmount} RM`
      : null,
    sample.detail,
  ].filter(Boolean);
  return parts.join(" · ");
}

interface OperationsPayrollWarningsBlockProps {
  warning: OperationsPayrollWarningResult;
  hasIncomeOrCostWarnings: boolean;
}

export function OperationsPayrollWarningsBlock({
  warning,
  hasIncomeOrCostWarnings,
}: OperationsPayrollWarningsBlockProps) {
  const locale = useLocale();
  const [unsyncedOpen, setUnsyncedOpen] = useState(false);

  if (!warning.showBox) return null;

  return (
    <div
      className={
        hasIncomeOrCostWarnings
          ? "mt-3 border-t border-amber-200 pt-3"
          : undefined
      }
    >
      <p className="font-semibold">
        {tLocal("operations.payrollWarning.title", locale)}
      </p>

      {warning.rules.length > 0 && (
        <ul className="mt-2 space-y-2 text-xs">
          {warning.rules.map((rule) => {
            const vars: Record<string, string> = {
              count: String(rule.count),
            };
            if (rule.sumExpected != null) {
              vars.sum = rule.sumExpected.toFixed(2);
            }
            if (rule.totalReturnCrates != null) {
              vars.qty = String(rule.totalReturnCrates);
            }

            const enTemplate = MESSAGES[RULE_MESSAGE_KEYS[rule.key]].en;

            return (
              <li key={rule.key}>
                <p className={severityClass(rule.severity)}>
                  {tLocal(RULE_MESSAGE_KEYS[rule.key], locale, vars)}
                  <span className="ml-1 font-normal text-amber-900/80">
                    {enTemplate.replace(
                      /\{(\w+)\}/g,
                      (_, name: string) => vars[name] ?? ""
                    )}
                  </span>
                </p>
                {rule.samples.length > 0 && (
                  <p className="mt-0.5 text-amber-900/90">
                    {tLocal("operations.payrollWarning.samples", locale)}：
                    {rule.samples.map(formatSample).join("；")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {warning.unsyncedCount > 0 && (
        <div className="mt-3 rounded-md border border-amber-200/80 bg-amber-100/40">
          <button
            type="button"
            onClick={() => setUnsyncedOpen((open) => !open)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-amber-950"
          >
            {unsyncedOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            {tLocal("operations.payrollWarning.unsyncedToggle", locale, {
              count: String(warning.unsyncedCount),
            })}
          </button>
          {unsyncedOpen && (
            <div className="border-t border-amber-200/80 px-3 pb-2 pt-1 text-xs text-amber-900">
              <p className="mb-1">
                {tLocal("operations.payrollWarning.unsyncedHint", locale)}
              </p>
              {warning.unsyncedSamples.length > 0 && (
                <p>{warning.unsyncedSamples.map(formatSample).join("；")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
