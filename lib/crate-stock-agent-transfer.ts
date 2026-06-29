import { isLocationPoolShipperCode } from "@/lib/constants/location-pool-shippers";
import { SHIPPER_KIND } from "@/lib/constants/shipper-kind";

export const LEGACY_POOL_AGENT_JOIN_NOTES = "legacy-pool-no-transfer";

export interface CrateStockRowSnapshot {
  crateTypeId: string;
  location: string;
  quantity: number;
}

export function isLegacyPoolAgentCode(code: string): boolean {
  return isLocationPoolShipperCode(code);
}

export function buildCrateStockSnapshots(
  rows: CrateStockRowSnapshot[]
): CrateStockRowSnapshot[] {
  return rows
    .filter((row) => row.quantity !== 0)
    .map((row) => ({
      crateTypeId: row.crateTypeId,
      location: row.location?.trim() ?? "",
      quantity: row.quantity,
    }));
}

export function assertOperationalMemberShipper(shipper: {
  shipperKind: string;
  code: string;
  active: boolean;
  crateStockAgentMembership?: { agentShipperId: string } | null;
}): void {
  if (!shipper.active) {
    throw new Error("寄货人已停用 Shipper is inactive");
  }
  if (shipper.shipperKind !== SHIPPER_KIND.OPERATIONAL) {
    throw new Error("仅运营寄货人可归入代理 Only operational shippers can join an agent");
  }
  if (isLocationPoolShipperCode(shipper.code)) {
    throw new Error("地点池寄货人不能作为组员 Location pool shippers cannot be members");
  }
  if (shipper.crateStockAgentMembership) {
    throw new Error(
      "该寄货人已归属其他代理,请先移出 Member already belongs to another agent"
    );
  }
}

export function slugifyAgentShipperCode(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "AGENT";
}
