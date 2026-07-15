"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getThaiSettlementPendingConfirm } from "@/app/actions/thai-cash-book-settlement";
import type { ThaiSettlementPendingConfirmItem } from "@/lib/cash-book/thai-cash-book-settlement";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WideTableScrollArea } from "@/components/shared/WideTableScrollArea";
import { formatDisplay } from "@/lib/date-utils";

function money(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ThaiCashBookSettlementView({ canWrite }: { canWrite: boolean }) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = now.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(monthEnd);
  const [pending, setPending] = useState<ThaiSettlementPendingConfirmItem[]>(
    []
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reload() {
    startTransition(async () => {
      setError(null);
      try {
        const p = await getThaiSettlementPendingConfirm({ fromDate, toDate });
        setPending(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial + explicit Reload
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <label className="space-y-1 text-sm">
          <span className="text-haidee-muted">从 From</span>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-haidee-muted">到 To</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={reload}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "刷新 Reload"
          )}
        </Button>
        <Link
          href="/financial/cash-book/ledger/thb"
          className={buttonVariants({ variant: "outline" })}
        >
          THB 账本明细
        </Link>
      </div>

      {error && (
        <p className="rounded-md border border-haidee-red/30 bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold text-haidee-text">
            待确认 Pending confirm
          </h2>
          <p className="text-sm text-haidee-muted">
            草稿由书记保存搬运/趋次数据时自动生成。打开后点「保存」即确认入账，无需再勾选。
            {!canWrite && "（当前只读）"}
          </p>
        </div>
        <WideTableScrollArea heightOffset={260} pinFirstColumn={false}>
          <TableHeader>
            <TableRow>
              <TableHead>凭证日期</TableHead>
              <TableHead>编号</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>付款对象</TableHead>
              <TableHead>说明</TableHead>
              <TableHead className="text-right">金额</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-haidee-muted"
                >
                  所选日期范围内没有待确认草稿
                </TableCell>
              </TableRow>
            )}
            {pending.map((row) => (
              <TableRow key={row.paymentVoucherId}>
                <TableCell>{formatDisplay(row.voucherDate)}</TableCell>
                <TableCell className="font-mono text-sm">
                  {row.voucherNo}
                </TableCell>
                <TableCell>
                  {row.sourceLabel}
                  <span className="ml-1 text-xs text-haidee-muted">
                    ({formatDisplay(row.sourceDate)})
                  </span>
                </TableCell>
                <TableCell>{row.paidTo}</TableCell>
                <TableCell className="max-w-[240px] truncate text-sm">
                  {row.particulars ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {money(row.totalAmount)}
                </TableCell>
                <TableCell>
                  {canWrite ? (
                    <Link
                      href={`/financial/cash-book/payment-voucher/${row.paymentVoucherId}/edit?from=thai-settlement`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      打开 Open
                    </Link>
                  ) : (
                    <Link
                      href={`/financial/cash-book/payment-voucher/${row.paymentVoucherId}?from=thai-settlement`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      打开 Open
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </WideTableScrollArea>
      </div>
    </div>
  );
}
