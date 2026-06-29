/**
 * AutoCount AR income account codes and tax types (Account_count.xlsx).
 * Debtor codes use 300x prefixes; income AccNo replaces leading 3 with 5.
 */

/** Normalize debtor code for lookup (trim + uppercase). */
export function normalizeDebtorCode(debtorCode: string): string {
  return debtorCode.trim().toUpperCase();
}

/**
 * Map debtor code to income account number: replace the first character `3` with `5`.
 * e.g. 3001-A009 → 5001-A009, 3002-H002 → 5002-H002, 3000-B002 → 5000-B002
 */
export function debtorCodeToIncomeAccNo(debtorCode: string): string {
  const code = normalizeDebtorCode(debtorCode);
  if (!code) return code;
  if (code[0] === "3") {
    return `5${code.slice(1)}`;
  }
  return code;
}

/**
 * Export (3000-) debtor TaxType overrides from the accounting template.
 * All other debtors return an empty string (no tax code on the AR line).
 */
export const AR_EXPORT_DEBTOR_TAX_TYPES: Readonly<Record<string, string>> = {
  /** BS EASTERN */
  "3000-B001": "SV-6",
  /** BEST BROTHER */
  "3000-B002": "SV-6",
  /** HON KEONG */
  "3000-H003": "SV-6",
  /** NHK */
  "3000-N001": "SV-6",
  /** PAKATAN */
  "3000-P001": "SV-6",
  /** TAWAKAR */
  "3000-T002": "ESV-6",
};

export type ArTaxType = "" | "SV-6" | "ESV-6";

/**
 * Resolve AutoCount TaxType for a debtor code.
 * Default: empty string (most 3001-/3002- shippers and non-listed 3000- codes).
 */
export function resolveArTaxType(debtorCode: string): ArTaxType {
  const code = normalizeDebtorCode(debtorCode);
  const taxType = AR_EXPORT_DEBTOR_TAX_TYPES[code];
  if (taxType === "SV-6" || taxType === "ESV-6") {
    return taxType;
  }
  return "";
}
