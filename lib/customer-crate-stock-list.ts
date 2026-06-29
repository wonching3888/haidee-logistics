import type { PickupLocationStockSummary } from "@/app/actions/customerCrateStock";
import type { CrateStockAgentRow } from "@/app/actions/customer-crate-stock-agent";
import {
  LOCATION_POOL_SHIPPER_CODES,
  stockLocationForPoolShipperCode,
} from "@/lib/constants/location-pool-shippers";

/** Drop legacy pickup summary rows when the same stock is shown as a crate_stock_agent row. */
export function filterPickupSummariesDedupedByAgents(
  summaries: PickupLocationStockSummary[],
  agents: CrateStockAgentRow[]
): PickupLocationStockSummary[] {
  const legacyLocations = new Set(
    agents
      .filter((agent) => agent.isLegacyPool)
      .map((agent) => stockLocationForPoolShipperCode(agent.shipperCode))
      .filter((location): location is "SONGKHLA" | "PATTANI" => location !== null)
  );

  return summaries.filter((summary) => !legacyLocations.has(summary.location));
}

/** Agents first: Songkhla → Pattani legacy pools, then other agents by name. */
export function sortAgentsForCustomerStockList(
  agents: CrateStockAgentRow[]
): CrateStockAgentRow[] {
  const legacyRank = (code: string) => {
    if (code === LOCATION_POOL_SHIPPER_CODES.SONGKHLA) return 0;
    if (code === LOCATION_POOL_SHIPPER_CODES.PATTANI) return 1;
    return 2;
  };

  return [...agents].sort((a, b) => {
    const aRank = a.isLegacyPool ? legacyRank(a.shipperCode) : 100;
    const bRank = b.isLegacyPool ? legacyRank(b.shipperCode) : 100;
    if (aRank !== bRank) return aRank - bRank;
    return a.shipperName.localeCompare(b.shipperName, undefined, {
      sensitivity: "base",
    });
  });
}
