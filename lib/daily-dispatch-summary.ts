import {
  DEPOT_GROUPS,
  type DepotGroup,
} from "@/lib/constants/depot-groups";

export interface DepotQtyLike {
  crate: number;
  box: number;
}

const OPTIONAL_DEPOT_LABELS = new Set<string>(["OTHERS", "OTHER"]);

function hasDepotQty(qty: DepotQtyLike): boolean {
  return qty.crate > 0 || qty.box > 0;
}

/** Standard markets always show; OTHERS/OTHER only when that column has quantity. */
export function resolveActiveDepotLabels(
  columnTotals: Record<string, DepotQtyLike>
): string[] {
  return DEPOT_GROUPS.filter((group: DepotGroup) => {
    if (!OPTIONAL_DEPOT_LABELS.has(group.label)) return true;
    return hasDepotQty(columnTotals[group.label] ?? { crate: 0, box: 0 });
  }).map((group) => group.label);
}
