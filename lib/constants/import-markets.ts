/** Market dropdown order for crate import form (strict list) */
export const IMPORT_MARKET_ORDER = [
  "KL",
  "MC",
  "BM",
  "A",
  "KD",
  "BP",
  "JB",
  "ABIBA",
  "ALPS",
  "ECONSAVE",
  "OTHERS",
] as const;

export function sortMarketsForImport<
  T extends { code: string; name: string },
>(markets: T[]): T[] {
  const orderMap = new Map<string, number>(
    IMPORT_MARKET_ORDER.map((code, index) => [code, index])
  );

  return [...markets]
    .filter((m) => orderMap.has(m.code))
    .sort((a, b) => orderMap.get(a.code)! - orderMap.get(b.code)!);
}

export function sortTrucksForImport<
  T extends { id: string; plate: string },
>(trucks: T[], priorityPlates: string[]): T[] {
  const prioritySet = new Set(priorityPlates);
  const byPlate = new Map(trucks.map((t) => [t.plate, t]));
  const priority = priorityPlates
    .map((plate) => byPlate.get(plate))
    .filter((t): t is T => Boolean(t));
  const rest = trucks.filter((t) => !prioritySet.has(t.plate));
  return [...priority, ...rest];
}
