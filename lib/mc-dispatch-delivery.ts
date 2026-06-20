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
