import {
  buildCrateExportDueToday,
  isAgentCrateExportPrefill,
  type CrateExportDueItem,
  type CrateQtyByCode,
} from "@/lib/crate-export-due-today";
import { loadCrateExportDayInput, loadLiveOwedIndex } from "@/lib/crate-export-day-context";
import { lookupLiveOwed, shouldUseLiveCrateExportOwed } from "@/lib/crate-export-live-owed";
import { isLocationPoolShipperCode } from "@/lib/constants/location-pool-shippers";
import { isCrateStockAgentShipper } from "@/lib/constants/shipper-kind";

function memberSuggestedFromDueToday(
  items: CrateExportDueItem[],
  shipperId: string,
  areaNote: string
): CrateQtyByCode | null {
  const note = areaNote.trim();
  if (!note) return null;

  for (const item of items) {
    if (item.kind !== "agent" && item.kind !== "pool") continue;

    const entityId =
      item.kind === "pool"
        ? item.group.poolShipperId
        : item.group.agentId;
    if (entityId !== shipperId) continue;

    for (const member of item.group.members) {
      const prefill = member.prefill;
      const memberNote = isAgentCrateExportPrefill(prefill)
        ? prefill.areaNote.trim()
        : "";
      if (memberNote !== note) continue;
      return isAgentCrateExportPrefill(prefill)
        ? { ...prefill.owedByCode }
        : { ...member.owed };
    }
  }

  return null;
}

/** Server-side suggested qty for save (create + edit), matching due-today owed rules. */
export async function resolveCrateExportSaveSuggestedByCode(input: {
  dateInput: string;
  shipperId: string;
  shipper: { code: string; shipperKind: string | null };
  location: string;
  areaNote?: string | null;
}): Promise<CrateQtyByCode> {
  if (!shouldUseLiveCrateExportOwed(input.dateInput)) {
    return {};
  }

  const isAgentReceipt =
    isCrateStockAgentShipper(input.shipper) ||
    isLocationPoolShipperCode(input.shipper.code);
  const areaNote = input.areaNote?.trim() ?? "";

  if (isAgentReceipt && areaNote) {
    const dayInput = await loadCrateExportDayInput(input.dateInput);
    const items = buildCrateExportDueToday(dayInput).items;
    const memberOwed = memberSuggestedFromDueToday(
      items,
      input.shipperId,
      areaNote
    );
    if (memberOwed) return memberOwed;
  }

  const index = await loadLiveOwedIndex(input.dateInput);
  return lookupLiveOwed(index, {
    shipperId: input.shipperId,
    location: input.location,
    isAgentReceipt,
  });
}
