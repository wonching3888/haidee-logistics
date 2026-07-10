"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewNextReceiptVoucherNo,
  saveReceiptVoucher,
  type ReceiptVoucherDetail,
} from "@/app/actions/cash-book-receipt-voucher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cashBookAccountsForLedger,
  type CashBookLedger,
} from "@/lib/constants/cash-book-accounts";
import { toDateInputValue } from "@/lib/date-utils";

export function ReceiptVoucherFormView({
  existing,
  canWrite,
}: {
  existing?: ReceiptVoucherDetail | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = toDateInputValue(new Date());

  const [book, setBook] = useState<CashBookLedger>(existing?.book ?? "THB");
  const [voucherDate, setVoucherDate] = useState(
    existing?.voucherDate ?? today
  );
  const [previewNo, setPreviewNo] = useState(existing?.voucherNo ?? "");
  const [receivedFrom, setReceivedFrom] = useState(
    existing?.receivedFrom ?? ""
  );
  const [accountCode, setAccountCode] = useState(existing?.accountCode ?? "");
  const [amount, setAmount] = useState(
    existing ? String(existing.amount) : ""
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [confirmed, setConfirmed] = useState(existing?.status === "confirmed");
  const [preparedBy, setPreparedBy] = useState(existing?.preparedBy ?? "");
  const [approvedBy, setApprovedBy] = useState(existing?.approvedBy ?? "");

  const accounts = useMemo(() => cashBookAccountsForLedger(book), [book]);

  useEffect(() => {
    if (existing) return;
    let cancelled = false;
    previewNextReceiptVoucherNo(voucherDate)
      .then((no) => {
        if (!cancelled) setPreviewNo(no);
      })
      .catch(() => {
        if (!cancelled) setPreviewNo("");
      });
    return () => {
      cancelled = true;
    };
  }, [voucherDate, existing]);

  useEffect(() => {
    if (!accountCode) return;
    const valid = accounts.some((a) => a.code === accountCode);
    if (!valid) setAccountCode("");
  }, [accounts, accountCode]);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const saved = await saveReceiptVoucher({
          id: existing?.id,
          book,
          voucherDate,
          receivedFrom,
          accountCode,
          amount: Number(amount),
          notes,
          confirmed,
          preparedBy,
          approvedBy,
        });
        if (!saved) throw new Error("保存失败");
        router.push(`/financial/cash-book/receipt-voucher/${saved.id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          {existing ? "编辑收款 Edit Receipt" : "新建收款 New Receipt"}
        </h2>
        <p className="mt-1 text-sm text-haidee-muted">
          编号 {(existing?.voucherNo ?? previewNo) || "（保存时生成）"}
        </p>
      </div>

      <div className="flex w-fit gap-2 rounded-lg border bg-white p-1">
        {(["THB", "MYR"] as const).map((ledger) => (
          <button
            key={ledger}
            type="button"
            disabled={!canWrite}
            onClick={() => setBook(ledger)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              book === ledger
                ? "bg-haidee-blue text-white"
                : "text-haidee-muted hover:bg-haidee-surface"
            }`}
          >
            {ledger} 账本
          </button>
        ))}
      </div>

      <div className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>日期 Date *</span>
          <Input
            type="date"
            value={voucherDate}
            disabled={!canWrite}
            onChange={(e) => setVoucherDate(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>来源 / 收款自 Received From *</span>
          <Input
            value={receivedFrom}
            disabled={!canWrite}
            onChange={(e) => setReceivedFrom(e.target.value)}
            placeholder="如：公司总部备用金 / 司机换零用钱"
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>科目 Account * ({book})</span>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
            value={accountCode}
            disabled={!canWrite}
            onChange={(e) => setAccountCode(e.target.value)}
          >
            <option value="">— 选择科目 —</option>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-haidee-muted">
            备用金/换零用钱若无完全对应科目，请先选最接近项（如跨本现金在手
            3202/3201）。科目待会计确认。
          </p>
        </label>
        <label className="space-y-1 text-sm">
          <span>金额 Amount ({book}) *</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            disabled={!canWrite}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>备注 Notes</span>
          <Input
            value={notes}
            disabled={!canWrite}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>制单人 Prepared by（可选）</span>
          <Input
            value={preparedBy}
            disabled={!canWrite}
            onChange={(e) => setPreparedBy(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>批准人 Approved by（可选）</span>
          <Input
            value={approvedBy}
            disabled={!canWrite}
            onChange={(e) => setApprovedBy(e.target.value)}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={!canWrite}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        确认 / 已审核（仅已审核才计入账本明细余额）
      </label>

      {error && (
        <p className="rounded-md border border-haidee-red/30 bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="bg-haidee-blue text-white"
            disabled={isPending}
            onClick={handleSubmit}
          >
            {isPending ? "保存中…" : "保存凭证 Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push("/financial/cash-book/receipt-voucher")
            }
          >
            返回列表 Back
          </Button>
        </div>
      )}
    </div>
  );
}
