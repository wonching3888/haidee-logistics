/** BOX is disposable packaging — not counted in barrel Qty totals */
export const BOX_COLUMN_CODE = "BOX";

/** Fixed tong-type column order for all D/O documents */
export const DO_TONG_COLUMNS = [
  { code: "BOX", header: "BOX" },
  { code: "HD_BHR", header: "HD(BHR)" },
  { code: "BH_BHR", header: "BH(BHR)" },
  { code: "LYS_BHR", header: "LYS(BHR)" },
  { code: "LL_BHR", header: "LL(BHR)" },
  { code: "ABB", header: "ABB" },
  { code: "WTL", header: "WTL" },
  { code: "VIO", header: "VIO" },
  { code: "MAR", header: "MAR" },
  { code: "SHK", header: "SHK" },
  { code: "GSK", header: "GSK" },
  { code: "BRO", header: "BRO" },
  { code: "GLY", header: "GLY" },
  { code: "BS", header: "BS" },
  { code: "OTHER", header: "Other" },
] as const;

const KNOWN_CODES = new Set<string>(
  DO_TONG_COLUMNS.filter((c) => c.code !== "OTHER").map((c) => c.code)
);

export function isBoxColumn(code: string): boolean {
  return code === BOX_COLUMN_CODE;
}

export function mapTongToColumn(tongCode: string): string {
  if (KNOWN_CODES.has(tongCode)) return tongCode;
  return "OTHER";
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
