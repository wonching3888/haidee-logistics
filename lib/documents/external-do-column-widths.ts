/** External D/O print column width percentages (no consignor column). */
export function externalDoColumnPercents(crateColumnCount: number) {
  const remarks = 40;
  const store = 14;
  const qty = 10;
  const no = 4;
  const area = 5;
  const crateTotal = Math.max(100 - remarks - store - qty - no - area, 12);
  const crateEach =
    crateColumnCount > 0 ? crateTotal / crateColumnCount : crateTotal;
  return { no, store, area, crateEach, qty, remarks };
}

export function externalDoColumnTotalPercent(crateColumnCount: number): number {
  const w = externalDoColumnPercents(crateColumnCount);
  return (
    w.no +
    w.store +
    w.area +
    w.crateEach * crateColumnCount +
    w.qty +
    w.remarks
  );
}
