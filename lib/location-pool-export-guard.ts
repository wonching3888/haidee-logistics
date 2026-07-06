import { prisma } from "@/lib/prisma";
import { isLocationPoolShipperCode } from "@/lib/constants/location-pool-shippers";
import { SHIPPER_KIND } from "@/lib/constants/shipper-kind";
import { t } from "@/lib/i18n/translate";
import type { UserLanguage } from "@/types";

/** Active members of any active crate_stock_agent (location pools + named agents). */
export async function loadCrateStockAgentMemberShipperIds(): Promise<Set<string>> {
  const agents = await prisma.shipper.findMany({
    where: {
      active: true,
      shipperKind: SHIPPER_KIND.CRATE_STOCK_AGENT,
    },
    select: { id: true },
  });
  if (agents.length === 0) return new Set();

  const members = await prisma.crateStockAgentMember.findMany({
    where: { agentShipperId: { in: agents.map((row) => row.id) } },
    select: { memberShipperId: true },
  });

  return new Set(members.map((row) => row.memberShipperId));
}

export function isLocationPoolAgentCode(code: string): boolean {
  return isLocationPoolShipperCode(code);
}

/** Blocks new exports where the operational shipper is an active agent member. */
export async function assertCrateExportShipperAllowed(
  shipperId: string,
  locale: UserLanguage = "zh"
): Promise<void> {
  const memberIds = await loadCrateStockAgentMemberShipperIds();
  if (memberIds.has(shipperId)) {
    throw new Error(t("crateExport.error.agentMemberBlocked", locale));
  }
}
