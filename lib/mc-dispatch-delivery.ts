import { MC_MARKET_CODE } from "@/lib/inbound-freight";

export interface McAssignedLineRef {
  marketCode: string | null | undefined;
  mcDeliveryMode: string | null | undefined;
}

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
