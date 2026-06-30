/** Fixed print widths for non-remarks columns; remarks col fills remaining table width. */
export const EXTERNAL_DO_FIXED_COL_MM = {
  no: 8,
  store: 28,
  area: 10,
  crateEach: 7,
  qty: 14,
} as const;

export function externalDoColumnWidths(crateColumnCount: number) {
  void crateColumnCount;
  return {
    no: `${EXTERNAL_DO_FIXED_COL_MM.no}mm`,
    store: `${EXTERNAL_DO_FIXED_COL_MM.store}mm`,
    area: `${EXTERNAL_DO_FIXED_COL_MM.area}mm`,
    crateEach: `${EXTERNAL_DO_FIXED_COL_MM.crateEach}mm`,
    qty: `${EXTERNAL_DO_FIXED_COL_MM.qty}mm`,
  };
}

/** Sum of fixed non-remarks column widths in mm (remarks = content width − this). */
export function externalDoFixedColumnsWidthMm(crateColumnCount: number): number {
  const { no, store, area, crateEach, qty } = EXTERNAL_DO_FIXED_COL_MM;
  return no + store + area + crateEach * crateColumnCount + qty;
}
