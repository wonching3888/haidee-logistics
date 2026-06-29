"use client";

import { Fragment, useState } from "react";
import {
  deleteInvoicePayment,
  resetInvoicePaymentToAutoAllocation,
} from "@/app/actions/invoice-payments";
import type { InvoiceCollectionsDetailPayment } from "@/app/actions/invoice-collections";
import { InvoiceManualAllocationDialog } from "@/components/invoice-collections/InvoiceManualAllocationDialog";
import { InvoicePaymentEditDialog } from "@/components/invoice-collections/InvoicePaymentEditDialog";
import { InvoiceCollectionsBilingualHead } from "@/components/invoice-collections/InvoiceCollectionsBilingualHead";
import { useT } from "@/components/shared/locale-context";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  invoiceBankAccountLabelKey,
  type InvoiceBankAccount,
} from "@/lib/constants/invoice-bank-accounts";
import {
  FIRST_COL_WIDTH,
  STICKY_BODY_FIRST,
  STICKY_HEAD_FIRST,
  stickyFirstColTableClass,
} from "@/lib/table-scroll";
import type {
  ReceivableCurrency,
  ReceivableCustomerKind,
} from "@/lib/receivable-invoices";
import { cn } from "@/lib/utils";
import { formatMoneyWithCurrency } from "@/lib/number-format";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

const DETAIL_PAYMENT_TABLE_HEIGHT = 260;
const COMPACT_COL_RIGHT = "min-w-[4.25rem] max-w-[5.5rem] w-[4.75rem] text-right";

function formatMoney(value: number, currency: string) {
  return formatMoneyWithCurrency(value, currency);
}

interface LedgerOption {
  customerKey: string;
  customerKind: ReceivableCustomerKind;
  customerId: string | null;
  customerName: string;
  currency: ReceivableCurrency;
}

interface ManualInvoiceOption {
  invoiceType: InvoiceCollectionsDetailPayment["allocations"][number]["invoiceType"];
  invoiceKey: string;
  invoiceNo: string | null;
  yearMonth: string;
  totalAmount: number;
  allocatedAmount: number;
}

interface InvoicePaymentSectionProps {
  payments: InvoiceCollectionsDetailPayment[];
  currency: ReceivableCurrency;
  currentCustomerKey: string;
  ledgerOptions: LedgerOption[];
  manualInvoiceOptions: ManualInvoiceOption[];
  canWritePayments: boolean;
  onAddPayment: () => void;
  onPaymentsChanged: () => void;
}

export function InvoicePaymentSection({
  payments,
  currency,
  currentCustomerKey,
  ledgerOptions,
  manualInvoiceOptions,
  canWritePayments,
  onAddPayment,
  onPaymentsChanged,
}: InvoicePaymentSectionProps) {
  const { t, tLocal } = useT();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editPayment, setEditPayment] =
    useState<InvoiceCollectionsDetailPayment | null>(null);
  const [manualPayment, setManualPayment] =
    useState<InvoiceCollectionsDetailPayment | null>(null);
  const [deletePayment, setDeletePayment] =
    useState<InvoiceCollectionsDetailPayment | null>(null);
  const [resetPayment, setResetPayment] =
    useState<InvoiceCollectionsDetailPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deletePayment) return;
    setBusy(true);
    setError(null);
    try {
      await deleteInvoicePayment(deletePayment.id);
      setDeletePayment(null);
      onPaymentsChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("invoiceCollections.payments.saveFailed")
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleResetAuto() {
    if (!resetPayment) return;
    setBusy(true);
    setError(null);
    try {
      await resetInvoicePaymentToAutoAllocation(resetPayment.id);
      setResetPayment(null);
      onPaymentsChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("invoiceCollections.payments.saveFailed")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-haidee-border">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h4 className="text-base font-semibold text-haidee-text">
          {t("invoiceCollections.payments.title")}
        </h4>
        {canWritePayments ? (
          <Button size="sm" onClick={onAddPayment}>
            {t("invoiceCollections.payments.add")}
          </Button>
        ) : null}
      </div>

      {payments.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-haidee-muted">
          {t("invoiceCollections.payments.empty")}
        </p>
      ) : (
        <ScrollMatrixTable
          className="border-0 shadow-none rounded-none"
          style={{
            height: DETAIL_PAYMENT_TABLE_HEIGHT,
            maxHeight: DETAIL_PAYMENT_TABLE_HEIGHT,
          }}
        >
          <Table noScrollContainer className={stickyFirstColTableClass}>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <InvoiceCollectionsBilingualHead
                  messageKey="invoiceCollections.payments.col.date"
                  className={cn(FIRST_COL_WIDTH, STICKY_HEAD_FIRST)}
                />
                <InvoiceCollectionsBilingualHead messageKey="invoiceCollections.payments.col.bankAccount" />
                <InvoiceCollectionsBilingualHead
                  messageKey="invoiceCollections.payments.col.amount"
                  align="right"
                  className={COMPACT_COL_RIGHT}
                />
                <InvoiceCollectionsBilingualHead
                  messageKey="invoiceCollections.payments.col.allocated"
                  align="right"
                  className={COMPACT_COL_RIGHT}
                />
                <InvoiceCollectionsBilingualHead
                  messageKey="invoiceCollections.payments.col.unallocated"
                  align="right"
                  className={COMPACT_COL_RIGHT}
                />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => {
                const expanded = expandedId === payment.id;
                const hasPrepaid = payment.unallocatedAmount > 0.001;
                return (
                  <Fragment key={payment.id}>
                    <TableRow>
                      <TableCell className={cn(FIRST_COL_WIDTH, STICKY_BODY_FIRST)}>
                        <div>{payment.paymentDate}</div>
                        {payment.allocationStrategy === "manual" ? (
                          <span className="mt-0.5 block text-xs text-haidee-muted">
                            {t("invoiceCollections.payments.strategyManual")}
                          </span>
                        ) : null}
                        {payment.notes ? (
                          <p className="mt-1 text-sm leading-snug text-haidee-text">
                            {payment.notes}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {tLocal(
                          invoiceBankAccountLabelKey(
                            payment.bankAccount as InvoiceBankAccount
                          )
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(payment.amount, currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(payment.allocatedAmount, currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span>{formatMoney(payment.unallocatedAmount, currency)}</span>
                        {hasPrepaid ? (
                          <span className="mt-0.5 block text-xs text-amber-700">
                            {t("invoiceCollections.payments.prepaidHint")}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {payment.allocations.length > 0 ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-sm text-haidee-blue hover:underline"
                              onClick={() =>
                                setExpandedId(expanded ? null : payment.id)
                              }
                            >
                              {expanded ? (
                                <ChevronDownIcon className="size-4" />
                              ) : (
                                <ChevronRightIcon className="size-4" />
                              )}
                              {t("invoiceCollections.payments.expandAllocations")}
                            </button>
                          ) : null}
                          {canWritePayments ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setEditPayment(payment)}
                              >
                                {t("invoiceCollections.payments.edit")}
                              </Button>
                              {payment.allocationStrategy === "manual" ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setManualPayment(payment)}
                                  >
                                    {t("invoiceCollections.payments.manualAllocate")}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setResetPayment(payment)}
                                  >
                                    {t("invoiceCollections.payments.resetAuto")}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setManualPayment(payment)}
                                >
                                  {t("invoiceCollections.payments.manualAllocate")}
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDeletePayment(payment)}
                              >
                                {t("invoiceCollections.payments.delete")}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded ? (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-haidee-surface/30 px-4 py-3">
                          <ul className="space-y-1 text-sm">
                            {payment.allocations.map((row) => (
                              <li
                                key={`${row.invoiceType}|${row.invoiceKey}|${row.isManual ? "m" : "a"}`}
                                className="flex flex-wrap items-center justify-between gap-2"
                              >
                                <span>
                                  {row.yearMonth} · {row.invoiceNo ?? row.invoiceKey}
                                  {row.isManual
                                    ? ` (${t("invoiceCollections.payments.strategyManual")})`
                                    : ""}
                                </span>
                                <span className="font-mono">
                                  {formatMoney(row.amount, currency)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {payment.notes ? (
                            <p className="mt-3 text-sm leading-snug text-haidee-text">
                              {payment.notes}
                            </p>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </ScrollMatrixTable>
      )}

      <InvoicePaymentEditDialog
        open={Boolean(editPayment)}
        onClose={() => setEditPayment(null)}
        onSaved={onPaymentsChanged}
        payment={editPayment}
        currentCustomerKey={currentCustomerKey}
        currency={currency}
        ledgerOptions={ledgerOptions}
      />

      <InvoiceManualAllocationDialog
        open={Boolean(manualPayment)}
        onClose={() => setManualPayment(null)}
        onSaved={onPaymentsChanged}
        payment={manualPayment}
        currency={currency}
        invoices={manualInvoiceOptions}
      />

      <Dialog
        open={Boolean(deletePayment)}
        onOpenChange={(open) => !open && setDeletePayment(null)}
      >
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("invoiceCollections.payments.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-haidee-muted">
            {t("invoiceCollections.payments.deleteConfirm")}
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletePayment(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>
              {busy ? "..." : t("invoiceCollections.payments.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resetPayment)}
        onOpenChange={(open) => !open && setResetPayment(null)}
      >
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("invoiceCollections.payments.resetAuto")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-haidee-muted">
            {t("invoiceCollections.payments.resetAutoConfirm")}
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetPayment(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handleResetAuto()} disabled={busy}>
              {busy ? "..." : t("invoiceCollections.payments.resetAuto")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
