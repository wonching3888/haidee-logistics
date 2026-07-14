"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  previewNextPaymentVoucherNo,
  savePaymentVoucher,
  type PaymentVoucherDetail,
} from "@/app/actions/cash-book-payment-voucher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cashBookAccountsForLedger,
  isCashBookLedger,
  PAYMENT_VOUCHER_METHODS,
  type CashBookLedger,
  type PaymentVoucherMethod,
} from "@/lib/constants/cash-book-accounts";
import { sumPaymentVoucherLines } from "@/lib/cash-book/payment-voucher-lines";
import { toDateInputValue } from "@/lib/date-utils";

type LineFormRow = {
  key: string;
  accountCode: string;
  particulars: string;
  amount: string;
};

function emptyLine(): LineFormRow {
  return {
    key: crypto.randomUUID(),
    accountCode: "",
    particulars: "",
    amount: "",
  };
}

function linesFromVoucher(v: PaymentVoucherDetail): LineFormRow[] {
  if (v.lines.length === 0) return [emptyLine()];
  return v.lines.map((line) => ({
    key: line.id,
    accountCode: line.accountCode,
    particulars: line.particulars ?? "",
    amount: String(line.amount),
  }));
}

function linesFromPrefill(search: URLSearchParams): LineFormRow[] | null {
  const particulars = search.get("particulars")?.trim() ?? "";
  const amount = search.get("amount")?.trim() ?? "";
  const accountCode = search.get("accountCode")?.trim() ?? "";
  if (!particulars && !amount && !accountCode) return null;
  return [
    {
      key: crypto.randomUUID(),
      accountCode,
      particulars,
      amount,
    },
  ];
}

export function PaymentVoucherFormView({
  existing,
  canWrite,
}: {
  existing?: PaymentVoucherDetail | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = toDateInputValue(new Date());

  const prefillBook = searchParams.get("book");
  const initialBook: CashBookLedger =
    existing?.book ??
    (prefillBook && isCashBookLedger(prefillBook) ? prefillBook : "THB");

  const [book, setBook] = useState<CashBookLedger>(initialBook);
  const [voucherDate, setVoucherDate] = useState(
    existing?.voucherDate ?? searchParams.get("voucherDate") ?? today
  );
  const [previewNo, setPreviewNo] = useState(existing?.voucherNo ?? "");
  const [paidTo, setPaidTo] = useState(
    existing?.paidTo ?? searchParams.get("paidTo") ?? ""
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentVoucherMethod>(
    (existing?.paymentMethod as PaymentVoucherMethod) ?? "CASH"
  );
  const [checkNo, setCheckNo] = useState(existing?.checkNo ?? "");
  const [checkDate, setCheckDate] = useState(existing?.checkDate ?? "");
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? "");
  const [confirmed, setConfirmed] = useState(existing?.status === "confirmed");
  const [payeeSignature, setPayeeSignature] = useState(
    existing?.payeeSignature ?? ""
  );
  const [preparedBy, setPreparedBy] = useState(existing?.preparedBy ?? "");
  const [approvedBy, setApprovedBy] = useState(existing?.approvedBy ?? "");
  const [lines, setLines] = useState<LineFormRow[]>(() => {
    if (existing) return linesFromVoucher(existing);
    const fromQuery = linesFromPrefill(searchParams);
    if (fromQuery) return fromQuery;
    return [emptyLine(), emptyLine()];
  });

  const accounts = useMemo(() => cashBookAccountsForLedger(book), [book]);

  useEffect(() => {
    if (existing) return;
    let cancelled = false;
    previewNextPaymentVoucherNo(voucherDate)
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
    setLines((rows) =>
      rows.map((row) => {
        if (!row.accountCode) return row;
        const valid = accounts.some((a) => a.code === row.accountCode);
        return valid ? row : { ...row, accountCode: "" };
      })
    );
  }, [accounts]);

  const parsedLines = lines.map((row) => ({
    amount: Number(row.amount) || 0,
  }));
  const total = sumPaymentVoucherLines(parsedLines);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await savePaymentVoucher({
          id: existing?.id,
          book,
          voucherDate,
          paidTo,
          paymentMethod,
          checkNo: paymentMethod === "CHEQUE" ? checkNo : null,
          checkDate: paymentMethod === "CHEQUE" ? checkDate : null,
          dueDate: dueDate || null,
          confirmed,
          payeeSignature,
          preparedBy,
          approvedBy,
          lines: lines.map((row) => ({
            accountCode: row.accountCode,
            particulars: row.particulars,
            amount: Number(row.amount),
          })),
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/financial/cash-book/payment-voucher/${result.data.id}`);
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
          {existing ? "编辑凭证 Edit Voucher" : "新建凭证 New Voucher"}
        </h2>
        <p className="mt-1 text-sm text-haidee-muted">
          编号 {(existing?.voucherNo ?? previewNo) || "（保存时生成）"}
        </p>
      </div>

      <div className="flex gap-2 rounded-lg border bg-white p-1 w-fit">
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
          <span>付款对象 Paid To *</span>
          <Input
            value={paidTo}
            disabled={!canWrite}
            onChange={(e) => setPaidTo(e.target.value)}
            placeholder="收款方名称"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>付款方式 Payment Method *</span>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={paymentMethod}
            disabled={!canWrite}
            onChange={(e) =>
              setPaymentMethod(e.target.value as PaymentVoucherMethod)
            }
          >
            {PAYMENT_VOUCHER_METHODS.map((m) => (
              <option key={m} value={m}>
                {m === "CASH"
                  ? "现金 Cash"
                  : m === "TRANSFER"
                    ? "转账 Transfer"
                    : "支票 Cheque"}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>到期日 Due Date（可选）</span>
          <Input
            type="date"
            value={dueDate}
            disabled={!canWrite}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
        {paymentMethod === "CHEQUE" && (
          <>
            <label className="space-y-1 text-sm">
              <span>支票号码 Cheque No. *</span>
              <Input
                value={checkNo}
                disabled={!canWrite}
                onChange={(e) => setCheckNo(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>支票日期 Cheque Date *</span>
              <Input
                type="date"
                value={checkDate}
                disabled={!canWrite}
                onChange={(e) => setCheckDate(e.target.value)}
              />
            </label>
          </>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-haidee-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">明细 Lines</p>
          {canWrite && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setLines((rows) => [...rows, emptyLine()])}
            >
              <Plus className="h-4 w-4" />
              加行 Add line
            </Button>
          )}
        </div>

        <div className="mt-3 space-y-3">
          {lines.map((row, index) => (
            <div
              key={row.key}
              className="grid gap-2 border-b border-haidee-border/60 pb-3 last:border-0 lg:grid-cols-[minmax(12rem,1.2fr)_minmax(10rem,1fr)_8rem_auto]"
            >
              <label className="space-y-1 text-sm">
                <span>科目 Account * ({book})</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                  value={row.accountCode}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setLines((rows) =>
                      rows.map((item) =>
                        item.key === row.key
                          ? { ...item, accountCode: e.target.value }
                          : item
                      )
                    )
                  }
                >
                  <option value="">— 选择科目 —</option>
                  {accounts.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>说明 Particulars</span>
                <Input
                  value={row.particulars}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setLines((rows) =>
                      rows.map((item) =>
                        item.key === row.key
                          ? { ...item, particulars: e.target.value }
                          : item
                      )
                    )
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>金额 Amount ({book}) *</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.amount}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setLines((rows) =>
                      rows.map((item) =>
                        item.key === row.key
                          ? { ...item, amount: e.target.value }
                          : item
                      )
                    )
                  }
                />
              </label>
              <div className="flex items-end">
                {canWrite && lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setLines((rows) => rows.filter((item) => item.key !== row.key))
                    }
                  >
                    <Trash2 className="h-4 w-4 text-haidee-red" />
                  </Button>
                )}
              </div>
              {index === 0 && (
                <p className="lg:col-span-4 text-xs text-haidee-muted">
                  科目必选；切换 THB/MYR 后科目列表会随之更换
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end border-t pt-3 text-sm font-semibold">
          合计 Total: {book}{" "}
          {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span>收款人 Payee（可选）</span>
          <Input
            value={payeeSignature}
            disabled={!canWrite}
            onChange={(e) => setPayeeSignature(e.target.value)}
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
        确认 / 已审核（泰国会计一步确认）
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
            onClick={() => router.push("/financial/cash-book/payment-voucher")}
          >
            返回列表 Back
          </Button>
        </div>
      )}
    </div>
  );
}
