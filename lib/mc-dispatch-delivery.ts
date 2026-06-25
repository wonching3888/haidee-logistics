import { MC_MARKET_CODE } from "@/lib/inbound-freight";
import { decimalToNumber } from "@/lib/freight-rates";

export interface McAssignedLineRef {
  marketCode: string | null | undefined;
  mcDeliveryMode: string | null | undefined;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Direct cost for one assigned line when MC is hauled by third party. */
export function lineMcThirdPartyHaulageMyr(line: {
  mcDeliveryMode: string | null | undefined;
  thirdPartyFee: unknown;
}): number {
  if (line.mcDeliveryMode !== "third_party") return 0;
  const fee = decimalToNumber(line.thirdPartyFee);
  if (fee == null || fee <= 0) return 0;
  return roundMoney(fee);
}

export const MC_THIRD_PARTY_HAULAGE_LABEL = "MC第三方车力";
export const MC_THIRD_PARTY_HAULAGE_LABEL_EN = "MC third-party haulage";

/** Trip has MC cargo assigned and every MC line is third_party (no self MC). */
export function tripMcAllThirdParty(lines: McAssignedLineRef[]): boolean {
  let hasMc = false;
  for (const line of lines) {
    if (line.marketCode !== MC_MARKET_CODE) continue;
    hasMc = true;
    if (line.mcDeliveryMode !== "third_party") return false;
  }
  return hasMc;
}

/** Payroll route allowance: drop MC when truck does not self-deliver to MC. */
export function marketsForTripAllowance(
  dispatchMarkets: string[],
  assignedLines: McAssignedLineRef[]
): string[] {
  if (!tripMcAllThirdParty(assignedLines)) {
    return dispatchMarkets;
  }
  return dispatchMarkets.filter((code) => code !== MC_MARKET_CODE);
}

/** Route-cost markets: drop MC when the trip hauls MC only via third party. */
export function effectiveMarketsForTripCost(
  dispatchMarkets: string[],
  assignedLines: McAssignedLineRef[]
): string[] {
  if (!tripMcAllThirdParty(assignedLines)) {
    return dispatchMarkets;
  }
  return dispatchMarkets.filter((code) => code !== MC_MARKET_CODE);
}

/**
 * Vehicle/toll allocation quantity: MC third-party lines excluded (align unload rule).
 * When the entire MC leg is third_party, every MC line should pass mcDeliveryMode
 * third_party and receive 0 vehicle qty.
 */
export function vehicleAllocatableQuantity(
  marketCode: string,
  quantity: number,
  mcDeliveryMode: string | null | undefined
): number {
  if (quantity <= 0) return 0;
  if (marketCode === MC_MARKET_CODE && mcDeliveryMode === "third_party") {
    return 0;
  }
  return quantity;
}

/**
 * Build TripCostLineInput vehicle flags from dispatch line refs.
 */
export function vehicleAllocatableQuantityFromLine(line: {
  marketCode: string | null | undefined;
  quantity: number;
  mcDeliveryMode: string | null | undefined;
}): number {
  if (!line.marketCode) return 0;
  return vehicleAllocatableQuantity(
    line.marketCode,
    line.quantity,
    line.mcDeliveryMode
  );
}

/**
 * P&L unload (Upah Turun) allocation only: MC barrels excluded when entire MC
 * leg is third_party. Vehicle/trip costs use vehicleAllocatableQuantity per line.
 */
export function pnlUnloadAllocatableQuantity(
  marketCode: string,
  quantity: number,
  excludeMcFromUnloadAllocation: boolean
): number {
  if (quantity <= 0) return 0;
  if (excludeMcFromUnloadAllocation && marketCode === MC_MARKET_CODE) return 0;
  return quantity;
}

/** @deprecated Use pnlUnloadAllocatableQuantity — unload-only, not vehicle costs. */
export const pnlLineAllocatableQuantity = pnlUnloadAllocatableQuantity;

export function mcAssignedLinesFromDispatchLines(
  lines: Array<{
    inboundLine: {
      dispatchStatus: string;
      mcDeliveryMode: string | null;
      stall: { market?: { code: string } | null };
    } | null;
  }>
): McAssignedLineRef[] {
  const refs: McAssignedLineRef[] = [];
  for (const row of lines) {
    const line = row.inboundLine;
    if (!line || line.dispatchStatus !== "assigned") continue;
    refs.push({
      marketCode: line.stall.market?.code ?? null,
      mcDeliveryMode: line.mcDeliveryMode,
    });
  }
  return refs;
}
