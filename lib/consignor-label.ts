/** Consignor row label: no area → "C P"; with area → "C P (TOT)" */
export function buildConsignorAreaLabel(
  shipperName: string,
  areaNote: string | null | undefined
): string {
  const area = areaNote?.trim();
  if (area) {
    return `${shipperName} (${area})`;
  }
  return shipperName;
}

/** Display crate + box counts, e.g. "33桶 + 2盒" */
export function formatCrateBoxQty(crateQty: number, boxQty: number): string {
  const parts: string[] = [];
  if (crateQty > 0) parts.push(`${crateQty}桶`);
  if (boxQty > 0) parts.push(`${boxQty}盒`);
  if (parts.length === 0) return "0";
  return parts.join(" + ");
}
