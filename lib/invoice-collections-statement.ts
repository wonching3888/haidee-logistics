import type {
  ReceivableInvoiceWithCollection,
  InvoicePaymentView,
} from "@/lib/invoice-allocation";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface DebtorStatementEntry {
  kind: "invoice" | "payment";
  id: string;
  date: string; // YYYY-MM-DD
  docNo: string | null;
  description: string;
  charge: number | null; // 发票金额，增加欠款
  credit: number | null; // 收款金额，减少欠款
  balance: number; // 这笔之后的滚动余额
}

export interface DebtorStatementRange {
  from: string;
  to: string;
}

export interface DebtorStatement {
  range: DebtorStatementRange;
  openingBalance: number;
  closingBalance: number;
  entries: DebtorStatementEntry[];
  totalCharge: number;
  totalCredit: number;
}

/**
 * 把发票（欠款+）和收款（欠款-）合并成一条时间线，按 range 切片，
 * range 之前的部分滚入 openingBalance——跟 sliceCashBookLedgerStatement
 * 是同一个模式，只是这里要合并两种不同来源。
 *
 * invoiceLabels：调用方（server action，能拿到 i18n）传入的发票说明文字
 * （key 是 `${invoiceType}|${invoiceKey}`），这个纯逻辑文件本身不引入
 * 翻译相关的依赖。
 */
export function buildDebtorStatement(input: {
  invoices: ReceivableInvoiceWithCollection[];
  payments: InvoicePaymentView[];
  invoiceLabels: Map<string, string>;
  range: DebtorStatementRange;
}): DebtorStatement {
  type RawEntry = Omit<DebtorStatementEntry, "balance">;

  const rawEntries: RawEntry[] = [
    ...input.invoices.map((invoice) => ({
      kind: "invoice" as const,
      id: `${invoice.invoiceType}:${invoice.invoiceKey}`,
      date: invoice.sortDate,
      docNo: invoice.invoiceNo,
      description:
        input.invoiceLabels.get(`${invoice.invoiceType}|${invoice.invoiceKey}`) ??
        invoice.invoiceNo ??
        invoice.invoiceKey,
      charge: invoice.totalAmount,
      credit: null,
    })),
    ...input.payments.map((payment) => ({
      kind: "payment" as const,
      id: payment.id,
      date: payment.paymentDate,
      docNo: null,
      description: payment.notes?.trim() || payment.bankAccount,
      charge: null,
      credit: payment.amount,
    })),
  ].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    if (a.kind !== b.kind) return a.kind === "invoice" ? -1 : 1;
    return (
      (a.docNo ?? "").localeCompare(b.docNo ?? "") || a.id.localeCompare(b.id)
    );
  });

  let openingBalance = 0;
  const inRangeRaw: RawEntry[] = [];
  for (const entry of rawEntries) {
    if (entry.date < input.range.from) {
      openingBalance = roundMoney(
        openingBalance + (entry.charge ?? 0) - (entry.credit ?? 0)
      );
      continue;
    }
    if (entry.date > input.range.to) continue;
    inRangeRaw.push(entry);
  }

  let balance = openingBalance;
  const entries: DebtorStatementEntry[] = inRangeRaw.map((entry) => {
    balance = roundMoney(
      balance + (entry.charge ?? 0) - (entry.credit ?? 0)
    );
    return { ...entry, balance };
  });

  const closingBalance =
    entries.length > 0
      ? entries[entries.length - 1]!.balance
      : openingBalance;

  let totalCharge = 0;
  let totalCredit = 0;
  for (const entry of entries) {
    if (entry.charge != null) totalCharge = roundMoney(totalCharge + entry.charge);
    if (entry.credit != null) totalCredit = roundMoney(totalCredit + entry.credit);
  }

  return {
    range: input.range,
    openingBalance,
    closingBalance,
    entries,
    totalCharge,
    totalCredit,
  };
}

export type DebtorStatementAgingBucketKey = "0-30" | "31-60" | "61-90" | "90+";

export interface DebtorStatementAgingBucket {
  key: DebtorStatementAgingBucketKey;
  label: string;
  amount: number;
}

/**
 * 把目前还欠着的发票（openAmount > 0）按"发票日期到 asOfDate 的天数"分档。
 * 注意：ReceivableInvoice 目前没有到期日/账期字段，账龄是从"开票日"算的，
 * 不是从"到期日"算的——这是现有数据的限制，不是本次新引入的简化，请在
 * 对账单上明确标注"账龄以开票日计"，避免对方误解成正式到期账龄。
 */
export function buildDebtorStatementAging(input: {
  invoices: ReceivableInvoiceWithCollection[];
  asOfDate: string;
}): { buckets: DebtorStatementAgingBucket[]; total: number } {
  const asOf = new Date(`${input.asOfDate}T00:00:00Z`).getTime();
  const buckets: Record<DebtorStatementAgingBucketKey, number> = {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };

  for (const invoice of input.invoices) {
    if (invoice.openAmount <= 0) continue;
    const invoiceTime = new Date(`${invoice.sortDate}T00:00:00Z`).getTime();
    const days = Math.floor((asOf - invoiceTime) / 86_400_000);
    const key: DebtorStatementAgingBucketKey =
      days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
    buckets[key] = roundMoney(buckets[key] + invoice.openAmount);
  }

  const labels: Record<DebtorStatementAgingBucketKey, string> = {
    "0-30": "0-30天 days",
    "31-60": "31-60天 days",
    "61-90": "61-90天 days",
    "90+": "90+天 days",
  };

  const result = (["0-30", "31-60", "61-90", "90+"] as const).map((key) => ({
    key,
    label: labels[key],
    amount: buckets[key],
  }));

  const total = roundMoney(result.reduce((sum, b) => sum + b.amount, 0));
  return { buckets: result, total };
}
