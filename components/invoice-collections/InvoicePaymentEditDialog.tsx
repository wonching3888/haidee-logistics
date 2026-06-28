"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { updateInvoicePayment } from "@/app/actions/invoice-payments";
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
import {
  bankAccountsForCurrency,
  invoiceBankAccountLabelKey,
  type InvoiceBankAccount,
} from "@/lib/constants/invoice-bank-accounts";
import type {
  ReceivableCurrency,
  ReceivableCustomerKind,
} from "@/lib/receivable-invoices";

interface LedgerOption {
  customerKey: string;
  customerKind: ReceivableCustomerKind;
  customerId: string | null;
  customerName: string;
  currency: ReceivableCurrency;
}

interface InvoicePaymentEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  payment: InvoiceCollectionsDetailPayment | null;
  currentCustomerKey: string;
  currency: ReceivableCurrency;
  ledgerOptions: LedgerOption[];
}

export function InvoicePaymentEditDialog({
  open,
  onClose,
  onSaved,
  payment,
  currentCustomerKey,
  currency,
  ledgerOptions,
}: InvoicePaymentEditDialogProps) {
  const { t } = useT();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [bankAccount, setBankAccount] = useState<InvoiceBankAccount>("CASH");
  const [notes, setNotes] = useState("");
  const [customerKey, setCustomerKey] = useState(currentCustomerKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencyLedgers = useMemo(
    () => ledgerOptions.filter((row) => row.currency === currency),
    [currency, ledgerOptions]
  );

  const selectedLedger = useMemo(
    () =>
      currencyLedgers.find((row) => row.customerKey === customerKey) ??
      currencyLedgers[0],
    [currencyLedgers, customerKey]
  );

  useEffect(() => {
    if (!open || !payment) return;
    setAmount(String(payment.amount));
    setPaymentDate(payment.paymentDate);
    setBankAccount(payment.bankAccount as InvoiceBankAccount);
    setNotes(payment.notes ?? "");
    setCustomerKey(currentCustomerKey);
    setError(null);
  }, [open, payment, currentCustomerKey]);

  const handleSave = useCallback(async () => {
    if (!payment || !selectedLedger) return;
    setError(null);
    setSaving(true);
    try {
      await updateInvoicePayment({
        paymentId: payment.id,
        amount: Number(amount),
        paymentDate,
        bankAccount,
        notes,
        customerKey: selectedLedger.customerKey,
        customerKind: selectedLedger.customerKind,
        customerId: selectedLedger.customerId,
        currency: selectedLedger.currency,
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
    amount,
    bankAccount,
    notes,
    onClose,
    onSaved,
    payment,
    paymentDate,
    selectedLedger,
    t,
  ]);

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("invoiceCollections.payments.editTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="text-haidee-muted">{t("invoiceCollections.col.customer")}</span>
            <Select
              value={customerKey}
              onValueChange={(value) => value && setCustomerKey(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyLedgers.map((row) => (
                  <SelectItem key={row.customerKey} value={row.customerKey}>
                    {row.customerName} · {row.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

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
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-haidee-muted">
                {t("invoiceCollections.payments.paymentDate")}
              </span>
              <Input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-haidee-muted">
              {t("invoiceCollections.payments.col.bankAccount")}
            </span>
            <Select
              value={bankAccount}
              onValueChange={(value) => setBankAccount(value as InvoiceBankAccount)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bankAccountsForCurrency(currency).map((account) => (
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
              rows={4}
              className="min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !selectedLedger}>
            {saving ? "..." : t("invoiceCollections.payments.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
