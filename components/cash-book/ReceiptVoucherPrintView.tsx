"use client";

import Link from "next/link";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import type { ReceiptVoucherDetail } from "@/app/actions/cash-book-receipt-voucher";
import { CashBookVoucherA5Document } from "@/components/cash-book/CashBookVoucherA5Document";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatInvoiceAmountInWords } from "@/lib/invoice-amount-words";
import { formatThbPaymentVoucherAmountInWords } from "@/lib/thai-baht-text";
import { formatDisplay } from "@/lib/date-utils";
import "@/components/documents/document-print.css";
import "@/components/cash-book/cash-book-voucher-print.css";

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

  const lines =
    voucher.lines.length > 0
      ? voucher.lines.map((line) => ({
          id: line.id,
          particulars: line.particulars,
          amount: line.amount,
        }))
      : [
          {
            id: "legacy-header",
            particulars: voucher.accountName,
            amount: voucher.amount,
          },
        ];

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

      <CashBookVoucherA5Document
        labels={{
          title: "ใบสำคัญรับ / Receipt Voucher",
          voucherNo: "เลขที่ / Voucher No.",
          date: "วันที่ / Date",
          party: "รับจาก / Received From",
          colParticulars: "รายละเอียด / Particulars",
          colAmount: "จำนวนเงิน / Amount",
          total: "รวม / Total",
          amountInWords: "จำนวนเงิน (ตัวอักษร) / Amount in words",
        }}
        voucherNo={voucher.voucherNo}
        voucherDateDisplay={formatDisplay(voucher.voucherDate)}
        partyValue={voucher.receivedFrom}
        book={voucher.book}
        metaExtra={
          voucher.notes &&
          voucher.notes.trim() !==
            (voucher.lines[0]?.particulars ?? "").trim() ? (
            <p className="payment-voucher-meta-span">
              <span className="font-medium">หมายเหตุ / Notes:</span>{" "}
              {voucher.notes}
            </p>
          ) : null
        }
        lines={lines}
        totalAmount={voucher.amount}
        amountWords={amountWords}
        signatures={[
          { label: "ผู้จัดทำ / Prepared by", name: voucher.preparedBy ?? "" },
          { label: "ผู้อนุมัติ / Approved by", name: voucher.approvedBy ?? "" },
        ]}
      />
    </div>
  );
}
