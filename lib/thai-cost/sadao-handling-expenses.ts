export interface SadaoHandlingOtherExpenseInput {
  id?: string;
  description: string;
  amountThb: number;
}

export interface SadaoHandlingOtherExpenseRow {
  id: string;
  description: string;
  amountThb: number;
}

export class SadaoHandlingExpenseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SadaoHandlingExpenseValidationError";
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Normalize and validate clerk-entered expense lines (drops blank rows). */
export function normalizeSadaoHandlingOtherExpenses(
  items: SadaoHandlingOtherExpenseInput[] | undefined
): SadaoHandlingOtherExpenseInput[] {
  if (!items?.length) return [];
  const out: SadaoHandlingOtherExpenseInput[] = [];
  for (let i = 0; i < items.length; i++) {
    const description = items[i].description.trim();
    const amountThb = items[i].amountThb;
    if (!description && (amountThb === 0 || !Number.isFinite(amountThb))) continue;
    if (!description) {
      throw new SadaoHandlingExpenseValidationError(
        `第 ${i + 1} 行其他开销须填写说明 description is required`
      );
    }
    if (!Number.isFinite(amountThb) || amountThb < 0) {
      throw new SadaoHandlingExpenseValidationError(
        `第 ${i + 1} 行金额无效 amount must be a non-negative number`
      );
    }
    out.push({ description, amountThb: roundMoney(amountThb) });
  }
  return out;
}

export function sumSadaoHandlingOtherExpensesThb(
  items: Array<{ amountThb: number }>
): number {
  return roundMoney(items.reduce((s, row) => s + (Number(row.amountThb) || 0), 0));
}

export function computeSadaoHandlingDayTotalThb(
  commissionThb: number,
  otherExpensesThb: number
): number {
  return roundMoney(commissionThb + otherExpensesThb);
}
