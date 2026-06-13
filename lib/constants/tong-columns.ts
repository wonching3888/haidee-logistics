/** BOX is disposable packaging — not counted in barrel Qty totals */
export const BOX_COLUMN_CODE = "BOX";

/**
 * Canonical tong-type column order for all reports and D/O documents.
 * ABB → WTL → BHR → … → BOX (BOX always last).
 */
export const DO_TONG_COLUMNS = [
  { code: "ABB", header: "ABB" },
  { code: "WTL", header: "WTL" },
  { code: "BHR", header: "BHR" },
  { code: "LL_BHR", header: "LL(BHR)" },
  { code: "VIO", header: "VIO" },
  { code: "MAR", header: "MAR" },
  { code: "SHK", header: "SHK" },
  { code: "GKS", header: "GKS" },
  { code: "BRO", header: "BRO" },
  { code: "GLY", header: "GLY" },
  { code: "BS", header: "BS" },
  { code: "BH", header: "BH" },
  { code: "SHS", header: "SHS" },
  { code: "OTHER", header: "Other" },
  { code: "BOX", header: "BOX" },
] as const;

const TONG_COLUMN_ORDER = new Map<string, number>(
  DO_TONG_COLUMNS.map((col, index) => [col.code, index])
);

const KNOWN_CODES = new Set<string>(
  DO_TONG_COLUMNS.filter((c) => c.code !== "OTHER").map((c) => c.code)
);

const LEGACY_TONG_COLUMN_MAP: Record<string, string> = {
  GSK: "GKS",
  HD_BHR: "BHR",
  BH_BHR: "BHR",
  LYS_BHR: "BHR",
  BAN_HENG: "BH",
  SAHASIN: "SHS",
};

export function isBoxColumn(code: string): boolean {
  return code === BOX_COLUMN_CODE;
}

export function mapTongToColumn(tongCode: string): string {
  const mapped = LEGACY_TONG_COLUMN_MAP[tongCode] ?? tongCode;
  if (KNOWN_CODES.has(mapped)) return mapped;
  return "OTHER";
}

/** Sort crate column codes by canonical report order (BOX last). */
export function sortTongColumnCodes(codes: Iterable<string>): string[] {
  return Array.from(codes).sort(
    (a, b) =>
      (TONG_COLUMN_ORDER.get(a) ?? 999) - (TONG_COLUMN_ORDER.get(b) ?? 999)
  );
}

/** D/O cell: BOX shows「N盒」, barrels show plain number */
export function formatDOCrateQuantity(code: string, quantity: number): string {
  if (quantity <= 0) return "";
  if (isBoxColumn(code)) return `${quantity}盒`;
  return String(quantity);
}

/** Qty column = sum of non-BOX barrel quantities only */
export function computeDORowQty(quantities: Record<string, number>): number {
  let sum = 0;
  for (const col of DO_TONG_COLUMNS) {
    if (!isBoxColumn(col.code)) {
      sum += quantities[col.code] ?? 0;
    }
  }
  return sum;
}

export function emptyQuantities(): Record<string, number> {
  const q: Record<string, number> = {};
  for (const col of DO_TONG_COLUMNS) q[col.code] = 0;
  return q;
}

export function sumQuantities(
  rows: { quantities: Record<string, number> }[]
): Record<string, number> {
  const totals = emptyQuantities();
  for (const row of rows) {
    for (const col of DO_TONG_COLUMNS) {
      totals[col.code] += row.quantities[col.code] ?? 0;
    }
  }
  return totals;
}

export function sumColumnQuantities(
  rows: { quantities: Record<string, number> }[],
  columnCode: string
): number {
  return rows.reduce(
    (sum, row) => sum + (row.quantities[columnCode] ?? 0),
    0
  );
}

export function computeBlockSubtotals(
  rows: { quantities: Record<string, number> }[],
  columnCodes: readonly string[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const code of columnCodes) {
    totals[code] = sumColumnQuantities(rows, code);
  }
  return totals;
}

/** D/O columns that have quantity on at least one row */
export function getActiveDOColumns(
  rows: { quantities: Record<string, number> }[]
) {
  const totals = sumQuantities(rows);
  return DO_TONG_COLUMNS.filter((col) => (totals[col.code] ?? 0) > 0);
}

/** Active columns in canonical order (for reports with pre-filtered codes). */
export function orderActiveTongColumns(
  columnTotals: Record<string, number>
) {
  return DO_TONG_COLUMNS.filter((col) => (columnTotals[col.code] ?? 0) > 0);
}
