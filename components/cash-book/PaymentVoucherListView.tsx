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
import type { PaymentVoucherDetail } from "@/app/actions/cash-book-payment-voucher";
import {
  paymentVoucherStatusLabel,
  type PaymentVoucherStatus,
} from "@/lib/constants/cash-book-accounts";
import { formatDisplay } from "@/lib/date-utils";

function money(amount: number, book: string) {
  return `${book} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export function PaymentVoucherListView({
  vouchers,
  canWrite,
}: {
  vouchers: PaymentVoucherDetail[];
  canWrite: boolean;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            付款凭证 Payment Voucher
          </h2>
          <p className="mt-1 text-sm text-haidee-muted">
            Cash Book 现金支出凭证录入与打印（暂不过账至明细账）
          </p>
        </div>
        {canWrite && (
          <Button
            className="gap-2 bg-haidee-blue text-white"
            onClick={() => router.push("/financial/cash-book/payment-voucher/new")}
          >
            <Plus className="h-4 w-4" />
            新建凭证 New Voucher
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
              <TableHead>付款对象 Paid To</TableHead>
              <TableHead className="text-right">合计 Total</TableHead>
              <TableHead>状态 Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vouchers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-haidee-muted">
                  暂无凭证 No vouchers yet
                </TableCell>
              </TableRow>
            ) : (
              vouchers.map((v) => (
                <TableRow key={v.id} className="cursor-pointer hover:bg-haidee-surface">
                  <TableCell>
                    <Link
                      href={`/financial/cash-book/payment-voucher/${v.id}`}
                      className="font-mono text-haidee-blue hover:underline"
                    >
                      {v.voucherNo}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDisplay(v.voucherDate)}</TableCell>
                  <TableCell>{v.book}</TableCell>
                  <TableCell>{v.paidTo}</TableCell>
                  <TableCell className="text-right font-mono">
                    {money(v.totalAmount, v.book)}
                  </TableCell>
                  <TableCell>
                    {paymentVoucherStatusLabel(v.status as PaymentVoucherStatus)}
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
