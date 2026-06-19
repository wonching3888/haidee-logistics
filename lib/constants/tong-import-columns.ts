/** Special column: notes only, stored in other_cols JSONB */
export const CRATE_IMPORT_OTHER_COLUMN = "OTHER";

/** Default visible columns on crate import form */
export const TONG_IMPORT_DEFAULT_COLUMNS = [
  { key: "ABB", label: "ABB", tongCode: "ABB" },
  { key: "WTL", label: "WTL", tongCode: "WTL" },
  { key: "BHR", label: "BHR", tongCode: "BHR" },
  { key: "VIO", label: "VIO", tongCode: "VIO" },
] as const;

/** All known crate types for save/load mapping (matches DO_TONG_COLUMNS order, no BOX) */
export const TONG_IMPORT_ALL_COLUMNS = [
  ...TONG_IMPORT_DEFAULT_COLUMNS,
  { key: "MAR", label: "MAR", tongCode: "MAR" },
  { key: "SHK", label: "SHK", tongCode: "SHK" },
  { key: "GKS", label: "GKS", tongCode: "GKS" },
  { key: "BRO", label: "BRO", tongCode: "BRO" },
  { key: "GLY", label: "GLY", tongCode: "GLY" },
  { key: "SKTN", label: "SKTN", tongCode: "SKTN" },
  { key: "BS", label: "BS", tongCode: "BS" },
  { key: "BH", label: "BH", tongCode: "BH" },
  { key: "SHS", label: "SHS", tongCode: "SHS" },
] as const;

/** @deprecated Use TONG_IMPORT_DEFAULT_COLUMNS / TONG_IMPORT_ALL_COLUMNS */
export const TONG_IMPORT_COLUMNS = TONG_IMPORT_ALL_COLUMNS;

const defaultColumnKeys = new Set<string>(
  TONG_IMPORT_DEFAULT_COLUMNS.map((c) => c.key)
);

export function isDefaultImportColumn(key: string): boolean {
  return defaultColumnKeys.has(key);
}

export function resolveImportTongCode(columnKey: string): string | null {
  const col = TONG_IMPORT_ALL_COLUMNS.find((c) => c.key === columnKey);
  if (col) return col.tongCode;
  return null;
}
