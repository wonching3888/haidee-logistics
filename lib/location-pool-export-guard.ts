import { prisma } from "@/lib/prisma";
import {
  LOCATION_POOL_SHIPPER_CODES,
  isLocationPoolShipperCode,
} from "@/lib/constants/location-pool-shippers";
import { t, type UserLanguage } from "@/lib/i18n/translate";

const LOCATION_POOL_AGENT_CODES = [
  LOCATION_POOL_SHIPPER_CODES.SONGKHLA,
  LOCATION_POOL_SHIPPER_CODES.PATTANI,
] as const;

/** Active members of LOC-SONGKHLA / LOC-PATTANI (location pools only). */
export async function loadLocationPoolMemberShipperIds(): Promise<Set<string>> {
  const poolAgents = await prisma.shipper.findMany({
    where: { code: { in: [...LOCATION_POOL_AGENT_CODES] } },
    select: { id: true },
  });
  if (poolAgents.length === 0) return new Set();

  const members = await prisma.crateStockAgentMember.findMany({
    where: { agentShipperId: { in: poolAgents.map((row) => row.id) } },
    select: { memberShipperId: true },
  });

  return new Set(members.map((row) => row.memberShipperId));
}

export function isLocationPoolAgentCode(code: string): boolean {
  return isLocationPoolShipperCode(code);
}

/** Blocks new exports where the operational shipper is a SK/PTN pool member. */
export async function assertCrateExportShipperAllowed(
  shipperId: string,
  locale: UserLanguage = "zh"
): Promise<void> {
  const memberIds = await loadLocationPoolMemberShipperIds();
  if (memberIds.has(shipperId)) {
    throw new Error(t("crateExport.error.locationPoolMemberBlocked", locale));
  }
}
