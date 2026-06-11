import type { MarketDORow } from "@/app/actions/documents";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import { MARKET_ORDER } from "@/lib/markets";

const AREA_DISPLAY_ORDER = new Map<string, number>(
  MARKET_ORDER.map((code, index) => [getMarketDisplayName(code), index])
);

/** @deprecated Each market maps to its own display name — use getMarketDisplayName */
export function getMarketDOAreaGroup(marketCode: string): string {
  return getMarketDisplayName(marketCode);
}

export interface ReportTruckGroup<T> {
  lorryNo: string;
  rows: T[];
}

export interface ReportAreaGroup<T> {
  areaName: string;
  trucks: ReportTruckGroup<T>[];
}

export interface AreaTruckRow {
  lorryNo: string;
  area: string;
  stallCode?: string;
  store?: string;
}

function rowStallKey(row: AreaTruckRow): string {
  return row.stallCode ?? row.store ?? "";
}

export function groupRowsByAreaAndTruck<T extends AreaTruckRow>(
  rows: T[]
): ReportAreaGroup<T>[] {
  const areaMap = new Map<string, Map<string, T[]>>();

  for (const row of rows) {
    const areaName = getMarketDisplayName(row.area);
    if (!areaMap.has(areaName)) {
      areaMap.set(areaName, new Map());
    }
    const truckMap = areaMap.get(areaName)!;
    if (!truckMap.has(row.lorryNo)) {
      truckMap.set(row.lorryNo, []);
    }
    truckMap.get(row.lorryNo)!.push(row);
  }

  const orderedAreaNames = [
    ...MARKET_ORDER.map((code) => getMarketDisplayName(code)).filter((name) =>
      areaMap.has(name)
    ),
    ...Array.from(areaMap.keys())
      .filter((name) => !AREA_DISPLAY_ORDER.has(name))
      .sort((a, b) => a.localeCompare(b)),
  ];

  return orderedAreaNames.map((areaName) => {
    const truckMap = areaMap.get(areaName)!;
    const trucks = Array.from(truckMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([lorryNo, truckRows]) => ({
        lorryNo,
        rows: truckRows.sort((a, b) =>
          rowStallKey(a).localeCompare(rowStallKey(b))
        ),
      }));

    return { areaName, trucks };
  });
}

export function groupMarketDORows(
  rows: MarketDORow[]
): ReportAreaGroup<MarketDORow>[] {
  return groupRowsByAreaAndTruck(rows);
}
