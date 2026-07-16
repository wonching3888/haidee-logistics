"use client";

import Link from "next/link";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import type { PaymentVoucherDetail } from "@/app/actions/cash-book-payment-voucher";
import { CashBookVoucherA5Document } from "@/components/cash-book/CashBookVoucherA5Document";
import { Button, buttonVariants } from "@/components/ui/button";
import { PAYMENT_VOUCHER_PRINT } from "@/lib/constants/cash-book-print";
import {
  paymentMethodLabel,
  type PaymentVoucherMethod,
} from "@/lib/constants/cash-book-accounts";
import { formatInvoiceAmountInWords } from "@/lib/invoice-amount-words";
import { formatThbPaymentVoucherAmountInWords } from "@/lib/thai-baht-text";
import { formatDisplay } from "@/lib/date-utils";
import "@/components/documents/document-print.css";
import "@/components/cash-book/cash-book-voucher-print.css";

export function PaymentVoucherPrintView({
  voucher,
  canWrite,
  returnTo = "payment-list",
}: {
  voucher: PaymentVoucherDetail;
  canWrite: boolean;
  returnTo?: "thai-settlement" | "ledger-thb" | "payment-list";
}) {
  const P = PAYMENT_VOUCHER_PRINT;
  const amountWords =
    voucher.book === "THB"
      ? formatThbPaymentVoucherAmountInWords(voucher.totalAmount)
      : formatInvoiceAmountInWords(voucher.totalAmount, "MYR");
  const listHref =
    returnTo === "thai-settlement"
      ? "/financial/cash-book/thai-settlement"
      : returnTo === "ledger-thb"
        ? "/financial/cash-book/ledger/thb"
        : "/financial/cash-book/payment-voucher";
  const editHref = `/financial/cash-book/payment-voucher/${voucher.id}/edit${
    returnTo === "payment-list" ? "" : `?from=${returnTo}`
  }`;

  return (
    <div className="space-y-4">
      <div className="no-print print:hidden flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={listHref}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            列表 List
          </Link>
          {canWrite && (
            <Link
              href={editHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="mr-1 h-4 w-4" />
              编辑 Edit
            </Link>
          )}
        </div>
        <Button
          type="button"
          className="gap-2 bg-haidee-blue text-white"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          打印 Print
        </Button>
      </div>

      <CashBookVoucherA5Document
        labels={{
          title: P.title,
          voucherNo: P.voucherNo,
          date: P.date,
          party: P.paidTo,
          colParticulars: P.colParticulars,
          colAmount: P.colAmount,
          total: P.total,
          amountInWords: P.amountInWords,
        }}
        voucherNo={voucher.voucherNo}
        voucherDateDisplay={formatDisplay(voucher.voucherDate)}
        partyValue={voucher.paidTo}
        book={voucher.book}
        metaExtra={
          <>
            <p>
              <span className="font-medium">{P.paymentMethod}:</span>{" "}
              {paymentMethodLabel(voucher.paymentMethod as PaymentVoucherMethod)}
            </p>
            {voucher.dueDate ? (
              <p>
                <span className="font-medium">{P.dueDate}:</span>{" "}
                {formatDisplay(voucher.dueDate)}
              </p>
            ) : null}
            {voucher.paymentMethod === "CHEQUE" ? (
              <>
                <p>
                  <span className="font-medium">{P.checkNo}:</span>{" "}
                  {voucher.checkNo ?? "—"}
                </p>
                <p>
                  <span className="font-medium">{P.checkDate}:</span>{" "}
                  {voucher.checkDate ? formatDisplay(voucher.checkDate) : "—"}
                </p>
              </>
            ) : null}
          </>
        }
        lines={voucher.lines.map((line) => ({
          id: line.id,
          particulars: line.particulars,
          amount: line.amount,
        }))}
        totalAmount={voucher.totalAmount}
        amountWords={amountWords}
        signatures={[
          { label: P.payeeSignature, name: voucher.payeeSignature ?? "" },
          { label: P.preparedBy, name: voucher.preparedBy ?? "" },
          { label: P.approvedBy, name: voucher.approvedBy ?? "" },
        ]}
      />
    </div>
  );
}
