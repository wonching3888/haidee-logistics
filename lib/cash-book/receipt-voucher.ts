import {
  findCashBookAccount,
  isCashBookLedger,
  type CashBookLedger,
} from "@/lib/constants/cash-book-accounts";

export class ReceiptVoucherValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReceiptVoucherValidationError";
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function assertCashBookLedger(value: string): CashBookLedger {
  if (!isCashBookLedger(value)) {
    throw new ReceiptVoucherValidationError("账本无效（须为 THB 或 MYR）");
  }
  return value;
}

export function normalizeReceiptVoucherInput(input: {
  book: string;
  receivedFrom: string;
  accountCode: string;
  amount: number;
  notes?: string | null;
}) {
  const book = assertCashBookLedger(input.book);
  const receivedFrom = input.receivedFrom.trim();
  if (!receivedFrom) {
    throw new ReceiptVoucherValidationError("收款来源不能为空");
  }
  const accountCode = input.accountCode.trim();
  if (!accountCode) {
    throw new ReceiptVoucherValidationError("科目必选");
  }
  const account = findCashBookAccount(book, accountCode);
  if (!account) {
    throw new ReceiptVoucherValidationError(
      `科目 ${accountCode} 不属于当前账本`
    );
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ReceiptVoucherValidationError("金额须大于 0");
  }
  return {
    book,
    receivedFrom,
    accountCode: account.code,
    accountName: account.name,
    amount: roundMoney(amount),
    notes: input.notes?.trim() || null,
  };
}
