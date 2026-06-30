/** External D/O print column layout — percentages sum to 100% (table fills page width). */
export const EXTERNAL_DO_COL = {
  no: 4,
  store: 14,
  area: 5,
  qty: 10,
  /** Target remarks share (35–40%). */
  remarksTarget: 38,
  /** Floor for remarks when many crate columns need space. */
  remarksMin: 32,
  /** Min % per crate column (~7mm on A4 portrait) so headers like SHK/BOX stay readable. */
  crateMinPercent: 3.8,
} as const;

export type ExternalDoColumnPercents = {
  no: number;
  store: number;
  area: number;
  qty: number;
  remarks: number;
  crateEach: number;
};

/** Percent widths for all columns; crate columns split the budget after fixed + remarks. */
export function externalDoColumnPercents(
  crateColumnCount: number
): ExternalDoColumnPercents {
  const { no, store, area, qty, remarksTarget, remarksMin, crateMinPercent } =
    EXTERNAL_DO_COL;
  const fixed = no + store + area + qty;

  let remarks: number = remarksTarget;
  let crateBudget = 100 - fixed - remarks;

  if (crateColumnCount > 0) {
    const crateEachAtTarget = crateBudget / crateColumnCount;
    if (crateEachAtTarget < crateMinPercent) {
      crateBudget = crateMinPercent * crateColumnCount;
      remarks = Math.max(100 - fixed - crateBudget, remarksMin);
      crateBudget = 100 - fixed - remarks;
    }
  }

  const crateEach =
    crateColumnCount > 0 ? crateBudget / crateColumnCount : 0;

  return { no, store, area, qty, remarks, crateEach };
}

export function externalDoColumnTotalPercent(crateColumnCount: number): number {
  const w = externalDoColumnPercents(crateColumnCount);
  return (
    w.no +
    w.store +
    w.area +
    w.qty +
    w.remarks +
    w.crateEach * crateColumnCount
  );
}

/** True when crate headers use compact styling (many active columns). */
export function externalDoUsesDenseCrateColumns(crateColumnCount: number): boolean {
  return crateColumnCount >= 7;
}
