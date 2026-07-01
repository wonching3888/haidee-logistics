import { getBangkokTodayDateInput } from "@/lib/date-utils";
import type {
  CrateExportDueItem,
  CrateQtyByCode,
} from "@/lib/crate-export-due-today";

/** Lookup index for live owed (inbound − returned), same source as due-today list. */
export interface LiveOwedIndex {
  standalone: Map<string, CrateQtyByCode>;
  byShipperLocation: Map<string, CrateQtyByCode>;
  byAgentShipperId: Map<string, CrateQtyByCode>;
}

export function shouldUseLiveCrateExportOwed(
  exportDateInput: string,
  todayInput: string = getBangkokTodayDateInput()
): boolean {
  return exportDateInput === todayInput;
}

export function buildLiveOwedIndexFromDueToday(
  items: CrateExportDueItem[]
): LiveOwedIndex {
  const index: LiveOwedIndex = {
    standalone: new Map(),
    byShipperLocation: new Map(),
    byAgentShipperId: new Map(),
  };

  for (const item of items) {
    if (item.kind === "row") {
      const { shipperId, location } = item.row.prefill;
      if (location) {
        index.byShipperLocation.set(`${shipperId}|${location}`, item.row.owed);
      } else {
        index.standalone.set(shipperId, item.row.owed);
      }
      continue;
    }

    if (item.kind === "agent") {
      index.byAgentShipperId.set(item.group.agentId, item.group.owed);
      continue;
    }

    index.byAgentShipperId.set(item.group.poolShipperId, item.group.owed);
  }

  return index;
}

export function lookupLiveOwed(
  index: LiveOwedIndex,
  params: {
    shipperId: string;
    location?: string;
    isAgentReceipt?: boolean;
  }
): CrateQtyByCode {
  if (params.isAgentReceipt) {
    return index.byAgentShipperId.get(params.shipperId) ?? {};
  }

  const location = params.location?.trim() ?? "";
  if (location) {
    return index.byShipperLocation.get(`${params.shipperId}|${location}`) ?? {};
  }

  return index.standalone.get(params.shipperId) ?? {};
}

export function liveShortageForLine(
  owedByCode: CrateQtyByCode,
  tongCode: string,
  quantityActual: number
): number {
  const owed = owedByCode[tongCode] ?? 0;
  return Math.max(0, owed - quantityActual);
}

export function totalLiveShortageForLines(
  owedByCode: CrateQtyByCode,
  lines: { tongCode: string; quantityActual: number }[]
): number {
  return lines.reduce(
    (sum, line) => sum + liveShortageForLine(owedByCode, line.tongCode, line.quantityActual),
    0
  );
}
