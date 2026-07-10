"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import type { PaymentVoucherDetail } from "@/app/actions/cash-book-payment-voucher";
import { Button, buttonVariants } from "@/components/ui/button";
import { PrintLetterhead } from "@/components/shared/PrintLogo";
import { PAYMENT_VOUCHER_PRINT } from "@/lib/constants/cash-book-print";
import {
  paymentMethodLabel,
  type PaymentVoucherMethod,
} from "@/lib/constants/cash-book-accounts";
import { formatInvoiceAmountInWords } from "@/lib/invoice-amount-words";
import { formatThbPaymentVoucherAmountInWords } from "@/lib/thai-baht-text";
import { formatDisplay } from "@/lib/date-utils";
import "@/components/documents/document-print.css";

function money(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function PaymentVoucherPrintView({
  voucher,
  canWrite,
}: {
  voucher: PaymentVoucherDetail;
  canWrite: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const P = PAYMENT_VOUCHER_PRINT;
  const amountWords =
    voucher.book === "THB"
      ? formatThbPaymentVoucherAmountInWords(voucher.totalAmount)
      : formatInvoiceAmountInWords(voucher.totalAmount, "MYR");

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/financial/cash-book/payment-voucher"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            列表 List
          </Link>
          {canWrite && (
            <Link
              href={`/financial/cash-book/payment-voucher/${voucher.id}/edit`}
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

      <div
        ref={printRef}
        className="document-print payment-voucher-print rounded-lg border bg-white p-6"
      >
        <PrintLetterhead
          nameZh=""
          nameTh="บริษัท ไฮดี โลจิสติกส์ จำกัด"
          nameEn="HAI DEE LOGISTICS CO., LTD."
        />

        <h1 className="mt-4 text-center text-lg font-bold">{P.title}</h1>

        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="font-medium">{P.voucherNo}:</span>{" "}
            <span className="font-mono">{voucher.voucherNo}</span>
          </p>
          <p>
            <span className="font-medium">{P.date}:</span>{" "}
            {formatDisplay(voucher.voucherDate)}
          </p>
          <p className="sm:col-span-2">
            <span className="font-medium">{P.paidTo}:</span> {voucher.paidTo}
          </p>
          <p>
            <span className="font-medium">{P.paymentMethod}:</span>{" "}
            {paymentMethodLabel(voucher.paymentMethod as PaymentVoucherMethod)}
          </p>
          {voucher.dueDate && (
            <p>
              <span className="font-medium">{P.dueDate}:</span>{" "}
              {formatDisplay(voucher.dueDate)}
            </p>
          )}
          {voucher.paymentMethod === "CHEQUE" && (
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
          )}
        </div>

        <table className="payment-voucher-table mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 pr-2 text-left align-bottom">
                {P.colParticulars}
              </th>
              <th className="w-32 py-2 text-right align-bottom whitespace-nowrap">
                {P.colAmount} ({voucher.book})
              </th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.map((line) => (
              <tr key={line.id} className="border-b border-gray-300">
                <td className="py-2 pr-2 align-top break-words">
                  {line.particulars || "—"}
                </td>
                <td className="py-2 text-right align-top font-mono whitespace-nowrap">
                  {money(line.amount)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-black font-bold">
              <td className="py-2 text-right">{P.total}</td>
              <td className="py-2 text-right font-mono">
                {money(voucher.totalAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 rounded border border-gray-300 bg-gray-50 p-3 text-sm">
          <p className="font-medium">{P.amountInWords}</p>
          <p className="payment-voucher-amount-words mt-1 break-words leading-relaxed">
            {amountWords}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6 text-center text-sm">
          <div>
            <div className="min-h-[3rem] border-b border-black" />
            <p className="mt-1">{P.payeeSignature}</p>
            <p className="text-xs text-gray-600">{voucher.payeeSignature ?? ""}</p>
          </div>
          <div>
            <div className="min-h-[3rem] border-b border-black" />
            <p className="mt-1">{P.preparedBy}</p>
            <p className="text-xs text-gray-600">{voucher.preparedBy ?? ""}</p>
          </div>
          <div>
            <div className="min-h-[3rem] border-b border-black" />
            <p className="mt-1">{P.approvedBy}</p>
            <p className="text-xs text-gray-600">{voucher.approvedBy ?? ""}</p>
          </div>
        </div>

        <p className="mt-8 text-xs text-gray-500">{P.footer}</p>
      </div>
    </div>
  );
}
