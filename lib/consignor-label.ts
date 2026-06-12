const MOBILE_NAME_MAX_LEN = 15;

/** Truncate consignor/customer names on mobile (full text via title attribute). */
export function truncateNameForMobile(
  name: string,
  maxLen = MOBILE_NAME_MAX_LEN
): string {
  if (name.length <= maxLen) return name;
  return `${name.slice(0, maxLen)}...`;
}

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

/** Loading matrix cell: "20", "3盒", "20+3盒", or "" */
export function cellDisplay(crateQty: number, boxQty: number): string {
  if (crateQty === 0 && boxQty === 0) return "";
  if (crateQty === 0) return `${boxQty}盒`;
  if (boxQty === 0) return `${crateQty}`;
  return `${crateQty}+${boxQty}盒`;
}

/** Display crate + box counts, e.g. "33桶 + 2盒" */
export function formatCrateBoxQty(crateQty: number, boxQty: number): string {
  const parts: string[] = [];
  if (crateQty > 0) parts.push(`${crateQty}桶`);
  if (boxQty > 0) parts.push(`${boxQty}盒`);
  if (parts.length === 0) return "0";
  return parts.join(" + ");
}
