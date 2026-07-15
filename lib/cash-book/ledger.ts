import type { CashBookLedger } from "@/lib/constants/cash-book-accounts";

export type CashBookLedgerEntryKind =
  | "opening"
  | "receipt"
  | "payment"
  | "opening_adjustment";

export interface CashBookLedgerSourceRow {
  kind: "receipt" | "payment";
  id: string;
  voucherNo: string;
  voucherDate: string; // YYYY-MM-DD
  description: string;
  amount: number;
  /** ISO timestamp of confirmation (confirmedAt) — secondary ledger sort key */
  sortKey: string;
}

export interface CashBookLedgerDisplayRow {
  kind: CashBookLedgerEntryKind;
  id: string;
  date: string;
  voucherNo: string | null;
  description: string;
  /** 支出（付款） */
  debit: number | null;
  /** 收入（收款） */
  credit: number | null;
  balance: number;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Ledger "说明 Description" text from primary (paidTo / receivedFrom) +
 * secondary (particulars / notes). Avoids "X — X" when both sides carry the
 * same (or trivially overlapping) content; keeps "A — B" when they differ.
 */
export function formatCashBookLedgerDescription(
  primary: string | null | undefined,
  secondary: string | null | undefined
): string {
  const a = (primary ?? "").trim();
  const b = (secondary ?? "").trim();
  if (!a && !b) return "";
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  // One side is only a trivial echo of the other (common in imports).
  if (b.includes(a) || a.includes(b)) {
    return a.length >= b.length ? a : b;
  }
  return `${a} — ${b}`;
}

/**
 * Build cash-book ledger rows.
 * Convention (per product): DEBIT = outflow (payment), CREDIT = inflow (receipt).
 * Only confirmed vouchers should be passed in as sourceRows.
 *
 * Sort order: business `voucherDate`, then confirmation timestamp (`sortKey`),
 * then voucher number / id for stable ties. Running balances follow this order.
 */
export function buildCashBookLedgerRows(input: {
  book: CashBookLedger;
  openingBalance: number;
  sourceRows: CashBookLedgerSourceRow[];
}): CashBookLedgerDisplayRow[] {
  const opening = roundMoney(input.openingBalance);
  const sorted = [...input.sourceRows].sort((a, b) => {
    const byDate = a.voucherDate.localeCompare(b.voucherDate);
    if (byDate !== 0) return byDate;
    const byConfirm = a.sortKey.localeCompare(b.sortKey);
    if (byConfirm !== 0) return byConfirm;
    const byVoucherNo = a.voucherNo.localeCompare(b.voucherNo);
    if (byVoucherNo !== 0) return byVoucherNo;
    return a.id.localeCompare(b.id);
  });

  const rows: CashBookLedgerDisplayRow[] = [
    {
      kind: "opening",
      id: `opening-${input.book}`,
      date: "",
      voucherNo: null,
      description: "期初余额 / Opening balance",
      debit: null,
      credit: null,
      balance: opening,
    },
  ];

  let balance = opening;
  for (const src of sorted) {
    const amount = roundMoney(src.amount);
    if (src.kind === "receipt") {
      balance = roundMoney(balance + amount);
      rows.push({
        kind: "receipt",
        id: src.id,
        date: src.voucherDate,
        voucherNo: src.voucherNo,
        description: src.description,
        debit: null,
        credit: amount,
        balance,
      });
    } else {
      balance = roundMoney(balance - amount);
      rows.push({
        kind: "payment",
        id: src.id,
        date: src.voucherDate,
        voucherNo: src.voucherNo,
        description: src.description,
        debit: amount,
        credit: null,
        balance,
      });
    }
  }

  return rows;
}
