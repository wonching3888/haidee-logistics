import type { MarketDORow } from "@/app/actions/documents";

/** Region titles for the market crate report (每日渔桶寄至). */
export const MARKET_DO_AREA_GROUPS: { name: string; codes: string[] }[] = [
  { name: "KUALA LUMPUR", codes: ["KL", "BP", "MP", "SL"] },
  { name: "MALACCA", codes: ["MC"] },
  { name: "ALOR SETAR", codes: ["A"] },
  { name: "BUTTERWORTH", codes: ["BM"] },
  { name: "PENANG / NORTH", codes: ["P", "TP", "NT", "KT", "SA"] },
  { name: "KEDAH", codes: ["KD"] },
  { name: "JOHOR BAHRU", codes: ["JB"] },
];

const AREA_GROUP_ORDER = new Map(
  MARKET_DO_AREA_GROUPS.map((group, index) => [group.name, index])
);

const CODE_TO_AREA_GROUP = new Map<string, string>();
for (const group of MARKET_DO_AREA_GROUPS) {
  for (const code of group.codes) {
    CODE_TO_AREA_GROUP.set(code, group.name);
  }
}

export function getMarketDOAreaGroup(marketCode: string): string {
  return CODE_TO_AREA_GROUP.get(marketCode) ?? marketCode.toUpperCase();
}

export interface MarketDOTruckGroup {
  lorryNo: string;
  rows: MarketDORow[];
}

export interface MarketDOAreaGroup {
  areaName: string;
  trucks: MarketDOTruckGroup[];
}

export function groupMarketDORows(rows: MarketDORow[]): MarketDOAreaGroup[] {
  const areaMap = new Map<string, Map<string, MarketDORow[]>>();

  for (const row of rows) {
    const areaName = getMarketDOAreaGroup(row.area);
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
    ...MARKET_DO_AREA_GROUPS.map((group) => group.name).filter((name) =>
      areaMap.has(name)
    ),
    ...Array.from(areaMap.keys())
      .filter((name) => !AREA_GROUP_ORDER.has(name))
      .sort((a, b) => a.localeCompare(b)),
  ];

  return orderedAreaNames.map((areaName) => {
    const truckMap = areaMap.get(areaName)!;
    const trucks = Array.from(truckMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([lorryNo, truckRows]) => ({
        lorryNo,
        rows: truckRows.sort((a, b) => a.stallCode.localeCompare(b.stallCode)),
      }));

    return { areaName, trucks };
  });
}
