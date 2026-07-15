"use client";

import Link from "next/link";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import type { ReceiptVoucherDetail } from "@/app/actions/cash-book-receipt-voucher";
import { Button, buttonVariants } from "@/components/ui/button";
import { PrintLetterhead } from "@/components/shared/PrintLogo";
import { formatInvoiceAmountInWords } from "@/lib/invoice-amount-words";
import { formatThbPaymentVoucherAmountInWords } from "@/lib/thai-baht-text";
import { formatDisplay } from "@/lib/date-utils";
import "@/components/documents/document-print.css";
import "@/components/cash-book/cash-book-voucher-print.css";

function money(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function ReceiptVoucherPrintView({
  voucher,
  canWrite,
}: {
  voucher: ReceiptVoucherDetail;
  canWrite: boolean;
}) {
  const amountWords =
    voucher.book === "THB"
      ? formatThbPaymentVoucherAmountInWords(voucher.amount)
      : formatInvoiceAmountInWords(voucher.amount, "MYR");

  return (
    <div className="space-y-4">
      <div className="no-print print:hidden flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/financial/cash-book/receipt-voucher"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            列表 List
          </Link>
          {canWrite && (
            <Link
              href={`/financial/cash-book/receipt-voucher/${voucher.id}/edit`}
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

      <div className="document-print payment-voucher-print rounded-lg border bg-white p-6">
        <PrintLetterhead
          nameZh=""
          nameTh="บริษัท ไฮดี โลจิสติกส์ จำกัด"
          nameEn="HAI DEE LOGISTICS CO., LTD."
        />
        <h1 className="mt-4 text-center text-lg font-bold">
          ใบสำคัญรับ / Receipt Voucher
        </h1>

        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="font-medium">เลขที่ / Voucher No.:</span>{" "}
            <span className="font-mono">{voucher.voucherNo}</span>
          </p>
          <p>
            <span className="font-medium">วันที่ / Date:</span>{" "}
            {formatDisplay(voucher.voucherDate)}
          </p>
          <p className="sm:col-span-2">
            <span className="font-medium">รับจาก / Received From:</span>{" "}
            {voucher.receivedFrom}
          </p>
          {voucher.notes && (
            <p className="sm:col-span-2">
              <span className="font-medium">หมายเหตุ / Notes:</span>{" "}
              {voucher.notes}
            </p>
          )}
        </div>

        <table className="payment-voucher-table mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 pr-2 text-left">รายละเอียด / Particulars</th>
              <th className="w-32 py-2 text-right whitespace-nowrap">
                จำนวนเงิน / Amount ({voucher.book})
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-300">
              <td className="py-2 pr-2">
                {voucher.accountName}
                {voucher.notes ? ` — ${voucher.notes}` : ""}
              </td>
              <td className="py-2 text-right font-mono">{money(voucher.amount)}</td>
            </tr>
            <tr className="border-t-2 border-black font-bold">
              <td className="py-2 text-right">รวม / Total</td>
              <td className="py-2 text-right font-mono">
                {money(voucher.amount)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 rounded border border-gray-300 bg-gray-50 p-3 text-sm">
          <p className="font-medium">จำนวนเงิน (ตัวอักษร) / Amount in words</p>
          <p className="payment-voucher-amount-words mt-1 break-words leading-relaxed">
            {amountWords}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6 text-center text-sm">
          <div>
            <div className="min-h-[3rem] border-b border-black" />
            <p className="mt-1">ผู้จัดทำ / Prepared by</p>
            <p className="text-xs text-gray-600">{voucher.preparedBy ?? ""}</p>
          </div>
          <div>
            <div className="min-h-[3rem] border-b border-black" />
            <p className="mt-1">ผู้อนุมัติ / Approved by</p>
            <p className="text-xs text-gray-600">{voucher.approvedBy ?? ""}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
