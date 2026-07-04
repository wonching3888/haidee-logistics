"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  exportBankReconciliationCsv,
  getBankReconciliationPageData,
  setInvoicePaymentReconciled,
} from "@/app/actions/bank-reconciliation";
import { useT } from "@/components/shared/locale-context";
import { DateInputField } from "@/components/shared/DateInputField";
import { Button } from "@/components/ui/button";
import {
  invoiceBankAccountLabelKey,
  type InvoiceBankAccount,
} from "@/lib/constants/invoice-bank-accounts";
import {
  defaultBankReconciliationMonthRange,
  type BankReconciliationAccountGroup,
  type BankReconciliationData,
} from "@/lib/bank-reconciliation-shared";
import { formatMoneyWithCurrency } from "@/lib/number-format";
import { cn } from "@/lib/utils";
import { formatDisplay } from "@/lib/date-utils";

type PageData = BankReconciliationData & { canWrite: boolean };

function formatMoney(value: number, currency: string) {
  return formatMoneyWithCurrency(value, currency);
}

function AccountGroupCard({
  group,
  canWrite,
  pendingId,
  onToggle,
}: {
  group: BankReconciliationAccountGroup;
  canWrite: boolean;
  pendingId: string | null;
  onToggle: (paymentId: string, isReconciled: boolean) => void;
}) {
  const { t, tLocal } = useT();
  const label = tLocal(
    invoiceBankAccountLabelKey(group.bankAccount as InvoiceBankAccount)
  );

  return (
    <section className="rounded-xl border border-haidee-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-haidee-text">
            {label}
            <span className="ml-2 text-sm font-normal text-haidee-muted">
              ({group.currency})
            </span>
          </h3>
          <p className="text-xs text-haidee-muted">
            {t("bankReconciliation.groupCount", {
              n: String(group.payments.length),
            })}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono font-semibold text-haidee-text">
            {formatMoney(group.totalAmount, group.currency)}
          </p>
          <p className="text-xs text-haidee-muted">
            {t("bankReconciliation.reconciledSubtotal")}:{" "}
            <span className="font-mono">
              {formatMoney(group.reconciledAmount, group.currency)}
            </span>
          </p>
        </div>
      </div>

      {group.payments.length === 0 ? (
        <p className="mt-4 text-sm text-haidee-muted">
          {t("bankReconciliation.emptyGroup")}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-haidee-border bg-haidee-surface text-haidee-muted">
                <th className="w-12 px-2 py-2 text-left font-medium">
                  {t("bankReconciliation.col.reconciled")}
                </th>
                <th className="px-2 py-2 text-left font-medium">
                  {t("bankReconciliation.col.date")}
                </th>
                <th className="px-2 py-2 text-left font-medium">
                  {t("bankReconciliation.col.customer")}
                </th>
                <th className="px-2 py-2 text-right font-medium">
                  {t("bankReconciliation.col.amount")}
                </th>
                <th className="px-2 py-2 text-left font-medium">
                  {t("bankReconciliation.col.invoiceNos")}
                </th>
              </tr>
            </thead>
            <tbody>
              {group.payments.map((payment) => (
                <tr
                  key={payment.id}
                  className={cn(
                    "border-b border-haidee-border/60",
                    payment.isReconciled && "bg-emerald-50/80"
                  )}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-haidee-blue"
                      checked={payment.isReconciled}
                      disabled={!canWrite || pendingId === payment.id}
                      onChange={(e) =>
                        onToggle(payment.id, e.target.checked)
                      }
                      aria-label={t("bankReconciliation.col.reconciled")}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono">
                    {formatDisplay(payment.paymentDate)}
                  </td>
                  <td className="px-2 py-2">{payment.customerName}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono font-semibold">
                    {formatMoney(payment.amount, payment.currency)}
                  </td>
                  <td className="px-2 py-2 text-haidee-muted">
                    {payment.invoiceNos || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-haidee-surface/50 font-semibold">
                <td colSpan={3} className="px-2 py-2 text-right">
                  {t("bankReconciliation.groupTotal")}
                </td>
                <td className="px-2 py-2 text-right font-mono">
                  {formatMoney(group.totalAmount, group.currency)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export function BankReconciliationView() {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaults = defaultBankReconciliationMonthRange();
  const dateFrom = searchParams.get("from") || defaults.dateFrom;
  const dateTo = searchParams.get("to") || defaults.dateTo;

  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(
    (from: string, to: string) => {
      startTransition(async () => {
        try {
          setError(null);
          const next = await getBankReconciliationPageData({
            dateFrom: from,
            dateTo: to,
          });
          setData(next);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    },
    []
  );

  useEffect(() => {
    load(dateFrom, dateTo);
  }, [dateFrom, dateTo, load]);

  function pushRange(from: string, to: string) {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    router.push(`/financial/bank-reconciliation?${params.toString()}`);
  }

  function handleToggle(paymentId: string, isReconciled: boolean) {
    if (!data?.canWrite) return;
    setPendingId(paymentId);
    startTransition(async () => {
      try {
        await setInvoicePaymentReconciled({ paymentId, isReconciled });
        setData((prev) => {
          if (!prev) return prev;
          const patchGroup = (
            groups: BankReconciliationAccountGroup[]
          ): BankReconciliationAccountGroup[] =>
            groups.map((group) => {
              const payments = group.payments.map((p) =>
                p.id === paymentId ? { ...p, isReconciled } : p
              );
              const reconciledAmount = payments
                .filter((p) => p.isReconciled)
                .reduce((s, p) => s + p.amount, 0);
              const unreconciledAmount = payments
                .filter((p) => !p.isReconciled)
                .reduce((s, p) => s + p.amount, 0);
              return {
                ...group,
                payments,
                reconciledAmount: Math.round(reconciledAmount * 100) / 100,
                unreconciledAmount: Math.round(unreconciledAmount * 100) / 100,
              };
            });
          return {
            ...prev,
            thbGroups: patchGroup(prev.thbGroups),
            myrGroups: patchGroup(prev.myrGroups),
          };
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPendingId(null);
      }
    });
  }

  async function handleExport() {
    try {
      setError(null);
      const result = await exportBankReconciliationCsv({ dateFrom, dateTo });
      const blob = new Blob([result.csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          {t("nav.bankReconciliation")}
        </h2>
        <p className="text-sm text-haidee-muted">
          {t("bankReconciliation.pageSubtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-haidee-border bg-white p-4 shadow-sm">
        <div className="space-y-1">
          <label className="text-xs font-medium text-haidee-muted">
            {t("bankReconciliation.dateFrom")}
          </label>
          <DateInputField
            value={dateFrom}
            onChange={(next) => pushRange(next || defaults.dateFrom, dateTo)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-haidee-muted">
            {t("bankReconciliation.dateTo")}
          </label>
          <DateInputField
            value={dateTo}
            onChange={(next) => pushRange(dateFrom, next || defaults.dateTo)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            const range = defaultBankReconciliationMonthRange();
            pushRange(range.dateFrom, range.dateTo);
          }}
        >
          {t("bankReconciliation.thisMonth")}
        </Button>
        <Button
          type="button"
          disabled={isPending || !data}
          onClick={() => void handleExport()}
        >
          {t("bankReconciliation.exportCsv")}
        </Button>
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      ) : null}

      {!data && isPending ? (
        <div className="h-32 animate-pulse rounded-lg bg-haidee-border/30" />
      ) : null}

      {data ? (
        <>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-haidee-text">THB</h3>
            <div className="space-y-4">
              {data.thbGroups.map((group) => (
                <AccountGroupCard
                  key={`THB-${group.bankAccount}`}
                  group={group}
                  canWrite={data.canWrite}
                  pendingId={pendingId}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-haidee-text">MYR</h3>
            <div className="space-y-4">
              {data.myrGroups.map((group) => (
                <AccountGroupCard
                  key={`MYR-${group.bankAccount}`}
                  group={group}
                  canWrite={data.canWrite}
                  pendingId={pendingId}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
