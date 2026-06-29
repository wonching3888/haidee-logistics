"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { setManualInvoicePaymentAllocation } from "@/app/actions/invoice-payments";
import type { InvoiceCollectionsDetailPayment } from "@/app/actions/invoice-collections";
import { useT } from "@/components/shared/locale-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReceivableCurrency, ReceivableInvoiceType } from "@/lib/receivable-invoices";
import { formatMoneyWithCurrency } from "@/lib/number-format";

interface ManualInvoiceOption {
  invoiceType: ReceivableInvoiceType;
  invoiceKey: string;
  invoiceNo: string | null;
  yearMonth: string;
  totalAmount: number;
  allocatedAmount: number;
}

interface ManualRow {
  invoiceType: ReceivableInvoiceType;
  invoiceKey: string;
  amount: string;
}

interface InvoiceManualAllocationDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  payment: InvoiceCollectionsDetailPayment | null;
  currency: ReceivableCurrency;
  invoices: ManualInvoiceOption[];
}

function formatMoney(value: number, currency: string) {
  return formatMoneyWithCurrency(value, currency);
}

function invoiceSelectValue(row: ManualRow) {
  return `${row.invoiceType}|${row.invoiceKey}`;
}

export function InvoiceManualAllocationDialog({
  open,
  onClose,
  onSaved,
  payment,
  currency,
  invoices,
}: InvoiceManualAllocationDialogProps) {
  const { t } = useT();
  const [rows, setRows] = useState<ManualRow[]>([]);
  const [confirmOverAllocation, setConfirmOverAllocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoiceByKey = useMemo(
    () =>
      new Map(
        invoices.map((invoice) => [
          `${invoice.invoiceType}|${invoice.invoiceKey}`,
          invoice,
        ])
      ),
    [invoices]
  );

  useEffect(() => {
    if (!open || !payment) return;
    const manualRows = payment.allocations
      .filter((row) => row.isManual)
      .map((row) => ({
        invoiceType: row.invoiceType,
        invoiceKey: row.invoiceKey,
        amount: String(row.amount),
      }));
    setRows(
      manualRows.length > 0
        ? manualRows
        : [{ invoiceType: "freight", invoiceKey: "", amount: "" }]
    );
    setConfirmOverAllocation(false);
    setError(null);
  }, [open, payment]);

  const manualSum = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const value = Number(row.amount);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [rows]
  );

  const remaining = payment ? payment.amount - manualSum : 0;

  const projectedOverInvoices = useMemo(() => {
    if (!payment) return [];
    const manualByInvoice = new Map<string, number>();
    for (const row of rows) {
      if (!row.invoiceKey) continue;
      const value = Number(row.amount);
      if (!Number.isFinite(value) || value <= 0) continue;
      const key = `${row.invoiceType}|${row.invoiceKey}`;
      manualByInvoice.set(key, (manualByInvoice.get(key) ?? 0) + value);
    }

    const warnings: Array<{ label: string; projected: number; total: number }> = [];
    for (const [key, manualAmount] of Array.from(manualByInvoice.entries())) {
      const invoice = invoiceByKey.get(key);
      if (!invoice) continue;
      const existingManualForPayment = payment.allocations
        .filter(
          (row) =>
            row.isManual &&
            `${row.invoiceType}|${row.invoiceKey}` === key
        )
        .reduce((sum, row) => sum + row.amount, 0);
      const otherAllocated = Math.max(
        0,
        invoice.allocatedAmount - existingManualForPayment
      );
      const projected = otherAllocated + manualAmount;
      if (projected > invoice.totalAmount + 0.001) {
        warnings.push({
          label: `${invoice.yearMonth} · ${invoice.invoiceNo ?? invoice.invoiceKey}`,
          projected,
          total: invoice.totalAmount,
        });
      }
    }
    return warnings;
  }, [invoiceByKey, payment, rows]);

  const handleSave = useCallback(async () => {
    if (!payment) return;
    setError(null);
    setSaving(true);
    try {
      const allocations = rows
        .filter((row) => row.invoiceKey && Number(row.amount) > 0)
        .map((row) => ({
          invoiceType: row.invoiceType,
          invoiceKey: row.invoiceKey,
          amount: Number(row.amount),
        }));

      await setManualInvoicePaymentAllocation({
        paymentId: payment.id,
        allocations,
        confirmOverAllocation,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("invoiceCollections.payments.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  }, [confirmOverAllocation, onClose, onSaved, payment, rows, t]);

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("invoiceCollections.payments.manualTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-haidee-muted">
            {t("invoiceCollections.payments.col.amount")}:{" "}
            <strong>{formatMoney(payment.amount, currency)}</strong>
          </p>

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div
                key={`${index}-${row.invoiceKey}`}
                className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]"
              >
                <Select
                  value={row.invoiceKey ? invoiceSelectValue(row) : ""}
                  onValueChange={(value) => {
                    if (!value) return;
                    const invoice = invoiceByKey.get(value);
                    if (!invoice) return;
                    setRows((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              invoiceType: invoice.invoiceType,
                              invoiceKey: invoice.invoiceKey,
                              amount: item.amount,
                            }
                          : item
                      )
                    );
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.map((invoice) => (
                      <SelectItem
                        key={`${invoice.invoiceType}|${invoice.invoiceKey}`}
                        value={`${invoice.invoiceType}|${invoice.invoiceKey}`}
                      >
                        {invoice.yearMonth} · {invoice.invoiceNo ?? invoice.invoiceKey}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={row.amount}
                  onChange={(event) =>
                    setRows((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, amount: event.target.value }
                          : item
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRows((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                  }
                  disabled={rows.length <= 1}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { invoiceType: "freight", invoiceKey: "", amount: "" },
              ])
            }
          >
            + Invoice
          </Button>

          <div className="rounded-lg border border-haidee-border bg-haidee-surface/40 p-3 text-sm">
            <p>
              {t("invoiceCollections.payments.manualSum")}:{" "}
              <span className="font-mono">{formatMoney(manualSum, currency)}</span>
            </p>
            <p>
              {t("invoiceCollections.payments.manualRemaining")}:{" "}
              <span className="font-mono">{formatMoney(remaining, currency)}</span>
            </p>
          </div>

          {projectedOverInvoices.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-medium">
                {t("invoiceCollections.payments.overInvoiceWarning")}
              </p>
              <ul className="mt-2 space-y-1">
                {projectedOverInvoices.map((row) => (
                  <li key={row.label}>
                    {row.label}: {formatMoney(row.projected, currency)} /{" "}
                    {formatMoney(row.total, currency)}
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={confirmOverAllocation}
                  onChange={(event) => setConfirmOverAllocation(event.target.checked)}
                />
                {t("invoiceCollections.payments.confirmOverAllocation")}
              </label>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={
              saving ||
              manualSum <= 0 ||
              manualSum > payment.amount + 0.001 ||
              (projectedOverInvoices.length > 0 && !confirmOverAllocation)
            }
          >
            {saving ? "..." : t("invoiceCollections.payments.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
