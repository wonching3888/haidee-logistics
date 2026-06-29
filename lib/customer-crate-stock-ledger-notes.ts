export function buildCustomerCrateStockLedgerNotes(input: {
  baseNote?: string | null;
  operationalShipperId: string;
  operationalShipperName?: string | null;
  stockAccountShipperId: string;
}): string | undefined {
  const base = input.baseNote?.trim() ?? "";
  const redirected =
    input.stockAccountShipperId !== input.operationalShipperId;
  const viaLabel =
    input.operationalShipperName?.trim() || input.operationalShipperId;
  const via = redirected ? `via=${viaLabel}` : "";

  if (base && via) return `${base} ${via}`;
  if (base) return base;
  if (via) return via;
  return undefined;
}
