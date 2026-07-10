"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReceiptVoucherDetail } from "@/app/actions/cash-book-receipt-voucher";
import {
  paymentVoucherStatusLabel,
  type PaymentVoucherStatus,
} from "@/lib/constants/cash-book-accounts";
import { formatDisplay } from "@/lib/date-utils";

function money(amount: number, book: string) {
  return `${book} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export function ReceiptVoucherListView({
  vouchers,
  canWrite,
}: {
  vouchers: ReceiptVoucherDetail[];
  canWrite: boolean;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            收款凭证 Receipt Voucher
          </h2>
          <p className="mt-1 text-sm text-haidee-muted">
            Cash Book 现金收入凭证（备用金注入、换零用钱等；确认后计入账本明细）
          </p>
        </div>
        {canWrite && (
          <Button
            className="gap-2 bg-haidee-blue text-white"
            onClick={() =>
              router.push("/financial/cash-book/receipt-voucher/new")
            }
          >
            <Plus className="h-4 w-4" />
            新建收款 New Receipt
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>编号 No.</TableHead>
              <TableHead>日期 Date</TableHead>
              <TableHead>账本 Book</TableHead>
              <TableHead>来源 From</TableHead>
              <TableHead className="text-right">金额 Amount</TableHead>
              <TableHead>状态 Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vouchers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-haidee-muted"
                >
                  暂无收款凭证 No receipts yet
                </TableCell>
              </TableRow>
            ) : (
              vouchers.map((v) => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer hover:bg-haidee-surface"
                >
                  <TableCell>
                    <Link
                      href={`/financial/cash-book/receipt-voucher/${v.id}`}
                      className="font-mono text-haidee-blue hover:underline"
                    >
                      {v.voucherNo}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDisplay(v.voucherDate)}</TableCell>
                  <TableCell>{v.book}</TableCell>
                  <TableCell>{v.receivedFrom}</TableCell>
                  <TableCell className="text-right font-mono">
                    {money(v.amount, v.book)}
                  </TableCell>
                  <TableCell>
                    {paymentVoucherStatusLabel(
                      v.status as PaymentVoucherStatus
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
