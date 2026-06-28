"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createInvoicePayment,
  getDefaultBankAccountForLedger,
  previewInvoicePaymentAllocation,
  type PreviewInvoicePaymentAllocationResult,
} from "@/app/actions/invoice-payments";
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
import {
  invoiceBankAccountLabelKey,
  type InvoiceBankAccount,
} from "@/lib/constants/invoice-bank-accounts";
import type { ReceivableCurrency, ReceivableCustomerKind } from "@/lib/receivable-invoices";

function formatMoney(value: number, currency: string) {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

interface InvoicePaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customerKey: string;
  customerKind: ReceivableCustomerKind;
  customerId: string | null;
  currency: ReceivableCurrency;
  openInvoices: Array<{
    yearMonth: string;
    invoiceNo: string | null;
    invoiceKey: string;
    totalAmount: number;
    openAmount: number;
  }>;
}

export function InvoicePaymentDialog({
  open,
  onClose,
  onSaved,
  customerKey,
  customerKind,
  customerId,
  currency,
  openInvoices,
}: InvoicePaymentDialogProps) {
  const { t } = useT();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [bankAccount, setBankAccount] = useState<InvoiceBankAccount>("CASH");
  const [bankAccounts, setBankAccounts] = useState<InvoiceBankAccount[]>([]);
  const [notes, setNotes] = useState("");
  const [preview, setPreview] =
    useState<PreviewInvoicePaymentAllocationResult | null>(null);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setPaymentDate(today);
    setNotes("");
    setPreview(null);
    setError(null);

    let cancelled = false;
    setLoadingDefaults(true);
    void getDefaultBankAccountForLedger({ customerKey, currency })
      .then((result) => {
        if (cancelled) return;
        setBankAccounts(result.bankAccounts);
        setBankAccount(result.defaultBankAccount);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("invoiceCollections.payments.saveFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoadingDefaults(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, customerKey, currency, today, t]);

  const parsedAmount = Number(amount);

  const handlePreview = useCallback(async () => {
    setError(null);
    setPreviewing(true);
    try {
      const result = await previewInvoicePaymentAllocation({
        customerKey,
        customerKind,
        currency,
        amount: parsedAmount,
        paymentDate,
      });
      setPreview(result);
    } catch (err) {
      setPreview(null);
      setError(
        err instanceof Error ? err.message : t("invoiceCollections.payments.saveFailed")
      );
    } finally {
      setPreviewing(false);
    }
  }, [
    currency,
    customerKey,
    customerKind,
    parsedAmount,
    paymentDate,
    t,
  ]);

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      await createInvoicePayment({
        customerKey,
        customerKind,
        customerId,
        currency,
        amount: parsedAmount,
        paymentDate,
        bankAccount,
        notes,
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
  }, [
    bankAccount,
    currency,
    customerId,
    customerKey,
    customerKind,
    notes,
    onClose,
    onSaved,
    parsedAmount,
    paymentDate,
    t,
  ]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("invoiceCollections.payments.dialogTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-haidee-muted">
            {currency} · {customerKey}
          </p>

          <div className="rounded-lg border border-haidee-border bg-haidee-surface/40 p-3">
            <p className="mb-2 text-sm font-medium text-haidee-text">
              {t("invoiceCollections.payments.openInvoices")}
            </p>
            {openInvoices.length === 0 ? (
              <p className="text-sm text-haidee-muted">—</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {openInvoices.map((invoice) => (
                  <li
                    key={invoice.invoiceKey}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      {invoice.yearMonth} · {invoice.invoiceNo ?? invoice.invoiceKey}
                    </span>
                    <span className="font-mono">
                      {formatMoney(invoice.openAmount, currency)} /{" "}
                      {formatMoney(invoice.totalAmount, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-haidee-muted">
                {t("invoiceCollections.payments.col.amount")}
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setPreview(null);
                }}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-haidee-muted">
                {t("invoiceCollections.payments.paymentDate")}
              </span>
              <Input
                type="date"
                value={paymentDate}
                onChange={(event) => {
                  setPaymentDate(event.target.value);
                  setPreview(null);
                }}
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-haidee-muted">
              {t("invoiceCollections.payments.col.bankAccount")}
            </span>
            <Select
              value={bankAccount}
              onValueChange={(value) => {
                setBankAccount(value as InvoiceBankAccount);
                setPreview(null);
              }}
              disabled={loadingDefaults}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map((account) => (
                  <SelectItem key={account} value={account}>
                    {t(invoiceBankAccountLabelKey(account))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-haidee-muted">
              {t("invoiceCollections.payments.notes")}
            </span>
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          {preview ? (
            <div className="rounded-lg border border-haidee-border bg-haidee-surface/40 p-3">
              <p className="mb-2 text-sm font-medium text-haidee-text">
                {t("invoiceCollections.payments.previewTitle")}
              </p>
              {preview.allocations.length === 0 ? (
                <p className="text-sm text-haidee-muted">
                  {formatMoney(preview.unallocatedAmount, currency)}{" "}
                  {t("invoiceCollections.payments.col.unallocated")}
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {preview.allocations.map((row) => (
                    <li
                      key={`${row.invoiceType}|${row.invoiceKey}`}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>
                        {row.yearMonth} · {row.invoiceNo ?? row.invoiceKey}
                      </span>
                      <span className="font-mono">
                        {formatMoney(row.amount, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {preview.unallocatedAmount > 0 && preview.allocations.length > 0 ? (
                <p className="mt-2 text-sm text-haidee-muted">
                  {t("invoiceCollections.payments.col.unallocated")}:{" "}
                  <span className="font-mono">
                    {formatMoney(preview.unallocatedAmount, currency)}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => void handlePreview()}
              disabled={previewing || saving || !Number.isFinite(parsedAmount) || parsedAmount <= 0}
            >
              {previewing
                ? "..."
                : t("invoiceCollections.payments.preview")}
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={
                saving ||
                !Number.isFinite(parsedAmount) ||
                parsedAmount <= 0 ||
                !preview
              }
            >
              {saving ? "..." : t("invoiceCollections.payments.confirm")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
