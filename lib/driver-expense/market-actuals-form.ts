import type { MarketActualFeeType } from "@/lib/driver-expense/market-actuals-service";
import type { MarketActualInput } from "@/lib/driver-expense/market-actuals-service";
import type { VoucherPrintBreakdown } from "@/lib/driver-expense/voucher-utils";

export type MarketActualFormMap = Record<string, string>;

export interface MarketActualDto {
  feeType: MarketActualFeeType;
  displayMarket: string;
  amount: number | null;
}

export function marketActualFormKey(
  feeType: MarketActualFeeType,
  displayMarket: string
) {
  return `${feeType}:${displayMarket}`;
}

export function getMarketActualFormValue(
  map: MarketActualFormMap,
  feeType: MarketActualFeeType,
  displayMarket: string
): string {
  return map[marketActualFormKey(feeType, displayMarket)] ?? "";
}

function parseFormAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function sumMarketActualFormValues(
  map: MarketActualFormMap,
  feeType: MarketActualFeeType
): number | null {
  let hasAny = false;
  let total = 0;
  const prefix = `${feeType}:`;
  for (const [key, raw] of Object.entries(map)) {
    if (!key.startsWith(prefix)) continue;
    const amount = parseFormAmount(raw);
    if (amount == null) continue;
    hasAny = true;
    total += amount;
  }
  if (!hasAny) return null;
  return Math.round(total * 100) / 100;
}

export function buildMarketActualInputsFromForm(
  map: MarketActualFormMap,
  breakdown: VoucherPrintBreakdown | null
): MarketActualInput[] {
  if (!breakdown) return [];

  const items: MarketActualInput[] = [];
  const pushRows = (
    feeType: MarketActualFeeType,
    rows: { market: string }[]
  ) => {
    for (const row of rows) {
      items.push({
        feeType,
        displayMarket: row.market,
        amount: parseFormAmount(getMarketActualFormValue(map, feeType, row.market)),
      });
    }
  };

  pushRows("parking", breakdown.parking);
  pushRows("kpb", breakdown.kpb);
  pushRows("unload", breakdown.upahTurun);
  return items;
}

export function hydrateMarketActualFormMap(
  breakdown: VoucherPrintBreakdown | null,
  marketActuals: MarketActualDto[],
  scalars: {
    parkingActual?: number | null;
    kpbActual?: number | null;
    upahTurunActual?: number | null;
  }
): MarketActualFormMap {
  const map: MarketActualFormMap = {};

  for (const row of marketActuals) {
    if (row.amount != null) {
      map[marketActualFormKey(row.feeType, row.displayMarket)] = String(row.amount);
    }
  }

  if (!breakdown) return map;

  const legacyScalarToLastMarket = (
    feeType: MarketActualFeeType,
    rows: { market: string }[],
    scalar: number | null | undefined
  ) => {
    if (scalar == null || rows.length === 0) return;
    const hasAny = rows.some(
      (row) => getMarketActualFormValue(map, feeType, row.market).trim() !== ""
    );
    if (hasAny) return;
    const last = rows[rows.length - 1];
    map[marketActualFormKey(feeType, last.market)] = String(scalar);
  };

  legacyScalarToLastMarket("parking", breakdown.parking, scalars.parkingActual);
  legacyScalarToLastMarket("kpb", breakdown.kpb, scalars.kpbActual);
  legacyScalarToLastMarket("unload", breakdown.upahTurun, scalars.upahTurunActual);

  return map;
}

export function marketActualFormMapToDto(
  map: MarketActualFormMap,
  breakdown: VoucherPrintBreakdown | null
): MarketActualDto[] {
  return buildMarketActualInputsFromForm(map, breakdown).map((row) => ({
    feeType: row.feeType,
    displayMarket: row.displayMarket,
    amount: row.amount,
  }));
}
