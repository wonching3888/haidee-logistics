/** Display-only number formatting (amounts / quantities). Not for IDs, years, or codes. */

const DISPLAY_LOCALE = "en-MY";

export function formatMoneyAmount(value: number): string {
  return value.toLocaleString(DISPLAY_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoneyWithCurrency(value: number, currency: string): string {
  return `${formatMoneyAmount(value)} ${currency}`;
}

/** Integer quantities: thousand separators, no decimals (crates, trips, line counts). */
export function formatQty(value: number): string {
  const rounded = Number.isFinite(value) ? Math.round(value) : 0;
  return rounded.toLocaleString(DISPLAY_LOCALE, {
    maximumFractionDigits: 0,
  });
}

export function formatQtyOrBlank(value: number | null | undefined): string {
  if (value == null || value === 0) return "";
  return formatQty(value);
}
