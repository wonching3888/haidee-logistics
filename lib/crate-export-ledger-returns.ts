/** Signed ledger row for export / export_void return aggregation. */
export type CrateExportLedgerReturnRow = {
  changeType: "export" | "export_void";
  shipperId: string;
  location: string | null;
  crateCode: string;
  quantity: number;
};

/**
 * Net customer export returns by stock-account shipper + location.
 * export_void rows are negative; voided batches no longer count as returned.
 */
export function aggregateLedgerExportReturnsByShipperLocation(
  rows: CrateExportLedgerReturnRow[]
): Map<string, Map<string, number>> {
  const nets = new Map<string, Map<string, number>>();

  for (const row of rows) {
    if (row.quantity === 0) continue;
    const loc = row.location?.trim() ?? "";
    const key = `${row.shipperId}|${loc}`;
    const map = nets.get(key) ?? new Map<string, number>();
    map.set(row.crateCode, (map.get(row.crateCode) ?? 0) + row.quantity);
    nets.set(key, map);
  }

  for (const [key, map] of Array.from(nets.entries())) {
    for (const [code, qty] of Array.from(map.entries())) {
      if (qty <= 0) map.delete(code);
      else map.set(code, qty);
    }
    if (map.size === 0) nets.delete(key);
  }

  return nets;
}
