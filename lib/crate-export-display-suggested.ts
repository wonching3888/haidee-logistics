import {
  buildCrateExportDueToday,
  isAgentCrateExportPrefill,
  type BuildCrateExportDueTodayInput,
  type CrateExportDueItem,
  type CrateQtyByCode,
} from "@/lib/crate-export-due-today";
import {
  buildLiveOwedIndexFromDueToday,
  lookupLiveOwed,
} from "@/lib/crate-export-live-owed";
import { isLocationPoolShipperCode } from "@/lib/constants/location-pool-shippers";
import { isCrateStockAgentShipper } from "@/lib/constants/shipper-kind";

type QtyMap = Map<string, number>;

function cloneQtyMap(map: QtyMap): QtyMap {
  return new Map(map);
}

function cloneExportsMap(source: Map<string, QtyMap>): Map<string, QtyMap> {
  const out = new Map<string, QtyMap>();
  for (const [key, map] of Array.from(source.entries())) {
    out.set(key, cloneQtyMap(map));
  }
  return out;
}

/** Subtract actuals from a return map (qty ≤ 0 keys removed). */
export function subtractActualsFromQtyMap(
  map: QtyMap,
  actualsByCode: CrateQtyByCode
): QtyMap {
  const out = cloneQtyMap(map);
  for (const [code, qty] of Object.entries(actualsByCode)) {
    if (!qty || qty <= 0) continue;
    const next = (out.get(code) ?? 0) - qty;
    if (next > 0) out.set(code, next);
    else out.delete(code);
  }
  return out;
}

function subtractActualsFromExportsKey(
  exportsMap: Map<string, QtyMap>,
  key: string,
  actualsByCode: CrateQtyByCode
) {
  const existing = exportsMap.get(key);
  if (!existing) return;
  const next = subtractActualsFromQtyMap(existing, actualsByCode);
  if (next.size === 0) exportsMap.delete(key);
  else exportsMap.set(key, next);
}

/**
 * Clone day input and remove one export's actuals from return maps so owed =
 * Dispatch due − (other same-day returns only).
 */
export function excludeExportActualsFromDayInput(
  dayInput: BuildCrateExportDueTodayInput,
  params: {
    shipperId: string;
    location: string;
    actualsByCode: CrateQtyByCode;
  }
): BuildCrateExportDueTodayInput {
  const exportsByShipperId = cloneExportsMap(dayInput.exportsByShipperId);
  const exportsByShipperLocation = cloneExportsMap(
    dayInput.exportsByShipperLocation
  );

  subtractActualsFromExportsKey(
    exportsByShipperId,
    params.shipperId,
    params.actualsByCode
  );

  const location = params.location.trim();
  if (location) {
    subtractActualsFromExportsKey(
      exportsByShipperLocation,
      `${params.shipperId}|${location}`,
      params.actualsByCode
    );
  }

  return {
    ...dayInput,
    exportsByShipperId,
    exportsByShipperLocation,
  };
}

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

/**
 * Same owed rules as save/live lookup, from an already-loaded day input
 * (optionally with one export's actuals already excluded).
 */
export function resolveSuggestedByCodeFromDayInput(
  dayInput: BuildCrateExportDueTodayInput,
  params: {
    shipperId: string;
    shipper: { code: string; shipperKind: string | null };
    location: string;
    areaNote?: string | null;
  }
): CrateQtyByCode {
  const isAgentReceipt =
    isCrateStockAgentShipper(params.shipper) ||
    isLocationPoolShipperCode(params.shipper.code);
  const areaNote = params.areaNote?.trim() ?? "";

  const items = buildCrateExportDueToday(dayInput).items;

  if (isAgentReceipt && areaNote) {
    const memberOwed = memberSuggestedFromDueToday(
      items,
      params.shipperId,
      areaNote
    );
    if (memberOwed) return memberOwed;
  }

  const index = buildLiveOwedIndexFromDueToday(items);
  return lookupLiveOwed(index, {
    shipperId: params.shipperId,
    location: params.location,
    isAgentReceipt,
  });
}

/** Display suggested for one export: live owed excluding that export's own actuals. */
export function resolveDisplaySuggestedForExport(
  dayInput: BuildCrateExportDueTodayInput,
  params: {
    shipperId: string;
    shipper: { code: string; shipperKind: string | null };
    location: string;
    areaNote?: string | null;
    actualsByCode: CrateQtyByCode;
  }
): CrateQtyByCode {
  const excluded = excludeExportActualsFromDayInput(dayInput, {
    shipperId: params.shipperId,
    location: params.location,
    actualsByCode: params.actualsByCode,
  });
  return resolveSuggestedByCodeFromDayInput(excluded, {
    shipperId: params.shipperId,
    shipper: params.shipper,
    location: params.location,
    areaNote: params.areaNote,
  });
}

export function actualsByCodeFromLines(
  lines: { tongCode: string; quantityActual: number }[]
): CrateQtyByCode {
  const out: CrateQtyByCode = {};
  for (const line of lines) {
    if (line.quantityActual <= 0) continue;
    out[line.tongCode] = (out[line.tongCode] ?? 0) + line.quantityActual;
  }
  return out;
}

/** Apply display suggested onto existing lines (keeps line set; refreshes suggested). */
export function applyDisplaySuggestedToLines<
  T extends { tongCode: string; quantityActual: number },
>(
  lines: T[],
  suggestedByCode: CrateQtyByCode
): (T & { quantitySuggested: number })[] {
  return lines.map((line) => ({
    ...line,
    quantitySuggested: suggestedByCode[line.tongCode] ?? 0,
  }));
}
