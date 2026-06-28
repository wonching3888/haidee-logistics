"use client";

import { Fragment, useState } from "react";
import type { InvoiceCollectionsDetailPayment } from "@/app/actions/invoice-collections";
import { useT } from "@/components/shared/locale-context";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { Button } from "@/components/ui/button";
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
import type { ReceivableCurrency } from "@/lib/receivable-invoices";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

function formatMoney(value: number, currency: string) {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

interface InvoicePaymentSectionProps {
  payments: InvoiceCollectionsDetailPayment[];
  currency: ReceivableCurrency;
  canWritePayments: boolean;
  onAddPayment: () => void;
}

export function InvoicePaymentSection({
  payments,
  currency,
  canWritePayments,
  onAddPayment,
}: InvoicePaymentSectionProps) {
  const { t } = useT();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          heightOffset={520}
          className="border-0 shadow-none rounded-none"
        >
          <Table noScrollContainer className={stickyFirstColTableClass}>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead className={cn(FIRST_COL_WIDTH, STICKY_HEAD_FIRST)}>
                  {t("invoiceCollections.payments.col.date")}
                </TableHead>
                <TableHead>{t("invoiceCollections.payments.col.bankAccount")}</TableHead>
                <TableHead className="text-right">
                  {t("invoiceCollections.payments.col.amount")}
                </TableHead>
                <TableHead className="text-right">
                  {t("invoiceCollections.payments.col.allocated")}
                </TableHead>
                <TableHead className="text-right">
                  {t("invoiceCollections.payments.col.unallocated")}
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => {
                const expanded = expandedId === payment.id;
                return (
                  <Fragment key={payment.id}>
                    <TableRow>
                      <TableCell className={cn(FIRST_COL_WIDTH, STICKY_BODY_FIRST)}>
                        {payment.paymentDate}
                      </TableCell>
                      <TableCell>
                        {t(
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
                        {formatMoney(payment.unallocatedAmount, currency)}
                      </TableCell>
                      <TableCell className="text-right">
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
                      </TableCell>
                    </TableRow>
                    {expanded ? (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-haidee-surface/30 px-4 py-3">
                          <ul className="space-y-1 text-sm">
                            {payment.allocations.map((row) => (
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
                          {payment.notes ? (
                            <p className="mt-2 text-xs text-haidee-muted">
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
    </div>
  );
}
