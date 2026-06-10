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

export function mapTongToColumn(tongCode: string): string {
  if (KNOWN_CODES.has(tongCode)) return tongCode;
  return "OTHER";
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
