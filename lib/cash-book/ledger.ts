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
  /** ISO timestamp of confirmation (confirmedAt) — primary ledger sort key */
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
 * Build cash-book ledger rows.
 * Convention (per product): DEBIT = outflow (payment), CREDIT = inflow (receipt).
 * Only confirmed vouchers should be passed in as sourceRows.
 *
 * Sort order: confirmation timestamp (`sortKey` = confirmedAt ISO), not business
 * date and not voucher number — so rolling balances match real history.
 */
export function buildCashBookLedgerRows(input: {
  book: CashBookLedger;
  openingBalance: number;
  sourceRows: CashBookLedgerSourceRow[];
}): CashBookLedgerDisplayRow[] {
  const opening = roundMoney(input.openingBalance);
  const sorted = [...input.sourceRows].sort((a, b) => {
    const byConfirm = a.sortKey.localeCompare(b.sortKey);
    if (byConfirm !== 0) return byConfirm;
    // Stable tie-break only if two confirms share the exact same timestamp
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
