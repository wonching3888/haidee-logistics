"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adjustCashBookOpeningBalance,
  type OpeningBalanceAdjustmentRow,
} from "@/app/actions/cash-book-ledger";
import type { CashBookLedgerDisplayRow } from "@/lib/cash-book/ledger";
import type { CashBookLedger } from "@/lib/constants/cash-book-accounts";
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
import { formatDisplay, formatDisplayDateTime } from "@/lib/date-utils";

function money(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function CashBookLedgerView({
  book,
  openingBalance,
  rows,
  adjustments,
  canWrite,
}: {
  book: CashBookLedger;
  openingBalance: number;
  rows: CashBookLedgerDisplayRow[];
  adjustments: OpeningBalanceAdjustmentRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newAmount, setNewAmount] = useState(String(openingBalance));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);

  const otherBook = book === "THB" ? "MYR" : "THB";
  const closing = rows[rows.length - 1]?.balance ?? openingBalance;

  function handleAdjust() {
    setError(null);
    startTransition(async () => {
      try {
        await adjustCashBookOpeningBalance({
          book,
          newAmount: Number(newAmount),
          notes,
        });
        setNotes("");
        setShowAdjust(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "调整失败");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            {book} 账本明细 Cash Book Ledger
          </h2>
          <p className="mt-1 text-sm text-haidee-muted">
            仅已审核凭证计入余额 · DEBIT=支出 · CREDIT=收入 · 期初默认 0
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/financial/cash-book/ledger/${otherBook.toLowerCase()}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            切换 {otherBook}
          </Link>
          <Link
            href="/financial/cash-book/payment-voucher"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            付款凭证
          </Link>
          <Link
            href="/financial/cash-book/receipt-voucher"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            收款凭证
          </Link>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-haidee-muted">期初 Opening</p>
          <p className="font-mono text-lg">{money(openingBalance)}</p>
        </div>
        <div>
          <p className="text-xs text-haidee-muted">期末 Closing</p>
          <p className="font-mono text-lg">{money(closing)}</p>
        </div>
        <div className="flex items-end justify-end">
          {canWrite && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdjust((v) => !v)}
            >
              调整期初余额
            </Button>
          )}
        </div>
      </div>

      {showAdjust && canWrite && (
        <div className="space-y-3 rounded-lg border border-dashed bg-white p-4">
          <p className="text-sm font-medium">
            期初余额调整（留痕，非裸改库）
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>新期初金额 New opening *</span>
              <Input
                type="number"
                step="0.01"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>说明 Notes *（必填留痕）</span>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="如：测试期初 / 正式上线期初"
              />
            </label>
          </div>
          {error && (
            <p className="text-sm text-haidee-red">{error}</p>
          )}
          <Button
            type="button"
            className="bg-haidee-blue text-white"
            disabled={isPending}
            onClick={handleAdjust}
          >
            {isPending ? "保存中…" : "保存调整 Save adjustment"}
          </Button>
        </div>
      )}

      <WideTableScrollArea
        heightOffset={260}
        pinFirstColumn={false}
        tableClassName="!min-w-0 w-full table-fixed"
      >
        <TableHeader>
          <TableRow>
            <TableHead className="w-[6.5rem] whitespace-nowrap">日期 Date</TableHead>
            <TableHead className="w-[9rem] whitespace-nowrap">编号 No.</TableHead>
            <TableHead className="w-[18rem] max-w-[18rem]">说明 Description</TableHead>
            <TableHead className="w-[6.5rem] whitespace-nowrap text-right">
              DEBIT 支出
            </TableHead>
            <TableHead className="w-[6.5rem] whitespace-nowrap text-right">
              CREDIT 收入
            </TableHead>
            <TableHead className="w-[7rem] whitespace-nowrap text-right">
              BALANCE 余额
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className={row.kind === "opening" ? "bg-haidee-surface/60" : undefined}
            >
              <TableCell className="whitespace-nowrap">
                {row.date ? formatDisplay(row.date) : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-sm">
                {row.voucherNo ? (
                  <Link
                    href={
                      row.kind === "payment"
                        ? `/financial/cash-book/payment-voucher/${row.id}?from=ledger-thb`
                        : `/financial/cash-book/receipt-voucher/${row.id}`
                    }
                    className="text-haidee-blue hover:underline"
                  >
                    {row.voucherNo}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="w-[18rem] max-w-[18rem]">
                <div
                  className="truncate text-sm"
                  title={row.description || undefined}
                >
                  {row.description || "—"}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-mono">
                {money(row.debit)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-mono">
                {money(row.credit)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-mono font-semibold">
                {money(row.balance)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </WideTableScrollArea>

      {adjustments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">期初调整留痕 Adjustment log</h3>
          <WideTableScrollArea heightOffset={260} pinFirstColumn={false}>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead className="text-right">原金额</TableHead>
                <TableHead className="text-right">新金额</TableHead>
                <TableHead>说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">
                    {formatDisplayDateTime(new Date(a.createdAt))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {money(a.previousAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {money(a.newAmount)}
                  </TableCell>
                  <TableCell>{a.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </WideTableScrollArea>
        </div>
      )}
    </div>
  );
}
