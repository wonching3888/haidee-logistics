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

const IMPORT_MARKET_ORDER_INDEX = new Map<string, number>(
  IMPORT_MARKET_ORDER.map((code, index) => [code, index])
);

/** Known markets first (IMPORT_MARKET_ORDER), then remaining active markets by code. */
export function sortMarketsForImport<
  T extends { code: string; name: string },
>(markets: T[]): T[] {
  return [...markets].sort((a, b) => {
    const ai = IMPORT_MARKET_ORDER_INDEX.get(a.code);
    const bi = IMPORT_MARKET_ORDER_INDEX.get(b.code);
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return a.code.localeCompare(b.code);
  });
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
