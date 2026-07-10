/** Cash Book ledger (THB / MYR) for Payment Voucher account dropdowns. */

export type CashBookLedger = "THB" | "MYR";

export interface CashBookAccount {
  code: string;
  name: string;
}

/** THB Cash Book (account 3201-0000) — 24 accounts per accounting chart (2026-07-09). */
export const CASH_BOOK_THB_ACCOUNTS: readonly CashBookAccount[] = [
  { code: "3202-0000", name: "CASH IN HAND - HD (RM) CASHIER" },
  { code: "6412-0000", name: "UPKEEP OF TYRE" },
  { code: "6416-0000", name: "CASH FUEL" },
  { code: "6420-0000", name: "RENTAL OF LORRY" },
  { code: "6425-0000", name: "THAI TOLL" },
  { code: "6500-0000", name: "THAI DRIVER TRIP WAGES(PAY DAILY)" },
  { code: "6501-0000", name: "THAI DRIVER SALARY(BASIC-ONCE MTHLY)" },
  { code: "6502-0000", name: "THAI G.WORKER WAGES(THB3/THB4) LOAD FISH" },
  { code: "6503-0000", name: "THAI G.WORKER SALARY(TWICE MTHLY)" },
  { code: "9002-0000", name: "STAFF ALLOWANCE" },
  { code: "9006-0000", name: "STAFF WELFARE" },
  { code: "9012-0000", name: "THAI G.WORKER LUNCH" },
  { code: "9103-0000", name: "UPKEEP OFFICE COMPUTER" },
  { code: "9104-0000", name: "UPKEEP OFFICE EQUIPMENT" },
  { code: "9110-0000", name: "PRINTING & STATIONERY" },
  { code: "9113-0000", name: "CLEANING & SANITARY" },
  { code: "9117-0000", name: "PRAYING EXP" },
  { code: "9126-0000", name: "WASH THE RAFT" },
  { code: "9127-0000", name: "THAI WASH LORRY" },
  { code: "9128-0000", name: "THAI CASH PURCHASE" },
  { code: "9130-0000", name: "THAI RENT ROOM" },
  { code: "9131-0000", name: "THAI POLICE FEE" },
  { code: "9132-0000", name: "WEIGHT CHARGES" },
  { code: "9307-0000", name: "DONATION/ENT/GIFT/REWARD" },
] as const;

/** RM Cash Book (account 3202-0000) — 13 accounts per accounting chart (2026-07-09). */
export const CASH_BOOK_MYR_ACCOUNTS: readonly CashBookAccount[] = [
  { code: "3050-W001", name: "OTHER DEBTOR - WTL EXPRESS SB" },
  { code: "3201-0000", name: "CASH IN HAND - HD (TB) CASHIER" },
  { code: "5300-0000", name: "GAIN ON FOREIGN EXCHANGE" },
  { code: "6301-0000", name: "CHOP BORDER PASS" },
  { code: "6302-0000", name: "FISH CHECKING" },
  { code: "6303-0000", name: "KPB(KL/MC)" },
  { code: "6304-0000", name: "LOAD/UNLOAD FEE" },
  { code: "6305-0000", name: "PARKING FEE" },
  { code: "6306-0000", name: "GENERAL TRIP EXPENSES(M'SIA DRIVER)" },
  { code: "6422-0000", name: "PLASTIC CRATE COLLECTION FEE[贷方]" },
  { code: "9004-0000", name: "CASUAL WAGES" },
  { code: "9205-0000", name: "LOSS ON FOREIGN EXCHANGE" },
  { code: "9308-0000", name: "COMMISSION GIVEN" },
] as const;

export const PAYMENT_VOUCHER_METHODS = ["CASH", "TRANSFER", "CHEQUE"] as const;
export type PaymentVoucherMethod = (typeof PAYMENT_VOUCHER_METHODS)[number];

export const PAYMENT_VOUCHER_STATUSES = ["draft", "confirmed"] as const;
export type PaymentVoucherStatus = (typeof PAYMENT_VOUCHER_STATUSES)[number];

export function isCashBookLedger(value: string): value is CashBookLedger {
  return value === "THB" || value === "MYR";
}

export function cashBookAccountsForLedger(
  book: CashBookLedger
): readonly CashBookAccount[] {
  return book === "THB" ? CASH_BOOK_THB_ACCOUNTS : CASH_BOOK_MYR_ACCOUNTS;
}

export function findCashBookAccount(
  book: CashBookLedger,
  code: string
): CashBookAccount | undefined {
  const normalized = code.trim();
  return cashBookAccountsForLedger(book).find((a) => a.code === normalized);
}

/** Longest account label — used for print layout self-test. */
export const CASH_BOOK_LONGEST_ACCOUNT_NAME =
  CASH_BOOK_THB_ACCOUNTS.find((a) => a.code === "6502-0000")!.name;

export function paymentMethodLabel(method: PaymentVoucherMethod): string {
  switch (method) {
    case "CASH":
      return "现金 / Cash";
    case "TRANSFER":
      return "转账 / Transfer";
    case "CHEQUE":
      return "支票 / Cheque";
    default:
      return method;
  }
}

export function paymentVoucherStatusLabel(status: PaymentVoucherStatus): string {
  return status === "confirmed" ? "已审核 / Confirmed" : "草稿 / Draft";
}
