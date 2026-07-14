import {
  findCashBookAccount,
  isCashBookLedger,
  PAYMENT_VOUCHER_METHODS,
  type CashBookLedger,
  type PaymentVoucherMethod,
} from "@/lib/constants/cash-book-accounts";

export interface PaymentVoucherLineInput {
  accountCode: string;
  particulars?: string | null;
  amount: number;
}

export interface NormalizedPaymentVoucherLine {
  accountCode: string;
  accountName: string;
  particulars: string | null;
  amount: number;
}

export class PaymentVoucherValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentVoucherValidationError";
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function parsePaymentVoucherMethod(
  value: string
): PaymentVoucherMethod {
  const normalized = value.trim().toUpperCase();
  if (
    !(PAYMENT_VOUCHER_METHODS as readonly string[]).includes(normalized)
  ) {
    throw new PaymentVoucherValidationError("付款方式无效");
  }
  return normalized as PaymentVoucherMethod;
}

/** Drop fully blank rows (no account and amount empty/0) before validation. */
export function filterBlankPaymentVoucherLines(
  lines: PaymentVoucherLineInput[] | undefined
): PaymentVoucherLineInput[] {
  if (!lines) return [];
  return lines.filter((row) => {
    const accountCode = row.accountCode?.trim() ?? "";
    const amount = Number(row.amount);
    const amountEmpty = !Number.isFinite(amount) || amount === 0;
    return !(accountCode === "" && amountEmpty);
  });
}

export function normalizePaymentVoucherLines(
  book: CashBookLedger,
  lines: PaymentVoucherLineInput[] | undefined
): NormalizedPaymentVoucherLine[] {
  if (!lines || lines.length === 0) {
    throw new PaymentVoucherValidationError("至少需要一行明细");
  }

  const out: NormalizedPaymentVoucherLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    const accountCode = row.accountCode?.trim() ?? "";
    if (!accountCode) {
      throw new PaymentVoucherValidationError(`第 ${i + 1} 行：科目必选`);
    }
    const account = findCashBookAccount(book, accountCode);
    if (!account) {
      throw new PaymentVoucherValidationError(
        `第 ${i + 1} 行：科目 ${accountCode} 不属于当前账本`
      );
    }
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new PaymentVoucherValidationError(`第 ${i + 1} 行：金额须大于 0`);
    }
    const particulars = row.particulars?.trim() || null;
    out.push({
      accountCode: account.code,
      accountName: account.name,
      particulars,
      amount: roundMoney(amount),
    });
  }
  return out;
}

export function sumPaymentVoucherLines(
  lines: Array<{ amount: number }>
): number {
  return roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
}

export function assertCashBookLedger(value: string): CashBookLedger {
  if (!isCashBookLedger(value)) {
    throw new PaymentVoucherValidationError("账本须为 THB 或 MYR");
  }
  return value;
}

export function validateChequeFields(input: {
  paymentMethod: PaymentVoucherMethod;
  checkNo?: string | null;
  checkDate?: string | null;
}) {
  if (input.paymentMethod !== "CHEQUE") return;
  if (!input.checkNo?.trim()) {
    throw new PaymentVoucherValidationError("支票付款须填写支票号码");
  }
  if (!input.checkDate?.trim()) {
    throw new PaymentVoucherValidationError("支票付款须填写支票日期");
  }
}
