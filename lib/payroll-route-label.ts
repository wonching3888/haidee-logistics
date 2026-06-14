const ROUTE_GROUP_MAP: Record<string, string> = {
  KL: "KL",
  BP: "KL",
  MP: "KL",
  SL: "KL",
  BM: "BM",
  P: "BM",
  TP: "BM",
  KT: "BM",
  NT: "BM",
  SA: "BM",
  MC: "MC",
  A: "A",
  KD: "KD",
  JB: "JB",
  OTHER: "OTHER",
};

const ROUTE_GROUP_ORDER = ["KL", "MC", "A", "KD", "JB", "BM", "OTHER"] as const;

/** Parse markets from array, comma string, or "A / BM / P" joined string. */
function parseMarketsForRouteLabel(
  markets: string[] | string | null | undefined
): string[] {
  if (markets == null || markets === "") return [];

  const source = Array.isArray(markets)
    ? markets
    : markets.split(",").map((part) => part.trim());

  const codes: string[] = [];
  for (const item of source) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    if (trimmed.includes("/")) {
      for (const part of trimmed.split("/")) {
        const code = part.trim().toUpperCase();
        if (code) codes.push(code);
      }
      continue;
    }

    codes.push(trimmed.toUpperCase());
  }

  return codes;
}

export function getRouteLabel(
  markets: string[] | string | null | undefined
): string {
  const input = parseMarketsForRouteLabel(markets);
  const groups = new Set(input.map((m) => ROUTE_GROUP_MAP[m]).filter(Boolean));
  return ROUTE_GROUP_ORDER.filter((route) => groups.has(route)).join(" / ");
}

export function getRouteGroups(
  markets: string[] | string | null | undefined
): string[] {
  const input = parseMarketsForRouteLabel(markets);
  const groups = new Set(input.map((m) => ROUTE_GROUP_MAP[m]).filter(Boolean));
  return ROUTE_GROUP_ORDER.filter((route) => groups.has(route));
}
