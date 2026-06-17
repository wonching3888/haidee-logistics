import {
  KL_KPB_STORE_PATTERN,
  PER_TRIP_UNLOAD_MARKETS,
  resolveUnloadingRateConfigMarket,
  usesKlUnloadFeeRules,
  ZERO_UNLOAD_MARKETS,
  type TruckSize,
} from "@/lib/driver-expense/constants";

export interface UnloadingRateConfigInput {
  market: string;
  smallCrate: number;
  largeCrate: number;
  box: number;
  kpbSmall: number;
  kpbLarge: number;
  kpbBox: number;
  kpbMode: string;
  unloadMode: string;
}

export interface UnloadingMarketLineInput {
  market: string;
  storeCode?: string | null;
  smallCrateQty: number;
  largeCrateQty: number;
  boxQty: number;
}

export interface UnloadingFeeCalcResult {
  market: string;
  storeCode: string | null;
  smallCrateQty: number;
  largeCrateQty: number;
  boxQty: number;
  unloadFee: number;
  kpbFee: number;
  isKpbExempt: boolean;
  tripLevelNote: string | null;
}

const BM_PINDAH_SMALL_TRUCK_FEE = 12;
const BM_PINDAH_LARGE_TRUCK_FEE = 20;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function rateForTruck(
  size: TruckSize,
  small: number,
  large: number
): number {
  return size === "small" ? small : large;
}

export function bmPindahTripUnloadFee(truckSize: TruckSize) {
  return rateForTruck(
    truckSize,
    BM_PINDAH_SMALL_TRUCK_FEE,
    BM_PINDAH_LARGE_TRUCK_FEE
  );
}

function isKlKpbExempt(storeCode: string | null | undefined) {
  const code = (storeCode ?? "").trim();
  if (!code) return true;
  return !KL_KPB_STORE_PATTERN.test(code);
}

export function calculateTripUnloadingFees(input: {
  lines: UnloadingMarketLineInput[];
  ratesByMarket: Map<string, UnloadingRateConfigInput>;
  truckSize: TruckSize;
}): UnloadingFeeCalcResult[] {
  const { lines, ratesByMarket, truckSize } = input;
  const results: UnloadingFeeCalcResult[] = [];
  let perTripUnloadCharged = false;
  let bmKpbCharged = false;
  let kdKpbCharged = false;

  for (const line of lines) {
    const market = line.market.trim().toUpperCase();
    const rate = ratesByMarket.get(resolveUnloadingRateConfigMarket(market));
    const storeCode = line.storeCode?.trim() || null;

    if (ZERO_UNLOAD_MARKETS.has(market) || !rate) {
      results.push({
        market,
        storeCode,
        smallCrateQty: line.smallCrateQty,
        largeCrateQty: line.largeCrateQty,
        boxQty: line.boxQty,
        unloadFee: 0,
        kpbFee: 0,
        isKpbExempt: true,
        tripLevelNote: ZERO_UNLOAD_MARKETS.has(market) ? "JB 免收" : null,
      });
      continue;
    }

    let unloadFee = 0;
    let kpbFee = 0;
    let isKpbExempt = false;
    let tripLevelNote: string | null = null;

    if (PER_TRIP_UNLOAD_MARKETS.has(market)) {
      if (!perTripUnloadCharged) {
        unloadFee = bmPindahTripUnloadFee(truckSize);
        perTripUnloadCharged = true;
        tripLevelNote = "TP/KT/P/SA/NT 整趟一次";
      } else {
        tripLevelNote = "同趟已计下货费";
      }
      isKpbExempt = true;
    } else if (usesKlUnloadFeeRules(market)) {
      unloadFee = roundMoney(
        line.smallCrateQty * rate.smallCrate +
          line.largeCrateQty * rate.largeCrate +
          line.boxQty * rate.box
      );
      if (isKlKpbExempt(storeCode)) {
        isKpbExempt = true;
        kpbFee = 0;
      } else {
        kpbFee = roundMoney(
          line.smallCrateQty * rate.kpbSmall +
            line.largeCrateQty * rate.kpbLarge +
            line.boxQty * rate.kpbBox
        );
      }
    } else if (market === "BM") {
      unloadFee = roundMoney(
        (line.smallCrateQty + line.largeCrateQty) * rate.smallCrate +
          line.boxQty * rate.box
      );
      if (!bmKpbCharged) {
        kpbFee = rateForTruck(truckSize, rate.kpbSmall, rate.kpbLarge);
        bmKpbCharged = true;
        tripLevelNote = tripLevelNote ?? "BM KPB 整趟一次";
      }
    } else if (market === "KD") {
      const perCrate = rate.smallCrate;
      unloadFee = roundMoney(
        (line.smallCrateQty + line.largeCrateQty + line.boxQty) * perCrate
      );
      if (!kdKpbCharged) {
        kpbFee = rateForTruck(truckSize, rate.kpbSmall, rate.kpbLarge);
        kdKpbCharged = true;
        tripLevelNote = tripLevelNote ?? "KD KPB 整趟一次";
      }
    } else {
      unloadFee = roundMoney(
        line.smallCrateQty * rate.smallCrate +
          line.largeCrateQty * rate.largeCrate +
          line.boxQty * rate.box
      );
      kpbFee = roundMoney(
        line.smallCrateQty * rate.kpbSmall +
          line.largeCrateQty * rate.kpbLarge +
          line.boxQty * rate.kpbBox
      );
    }

    results.push({
      market,
      storeCode,
      smallCrateQty: line.smallCrateQty,
      largeCrateQty: line.largeCrateQty,
      boxQty: line.boxQty,
      unloadFee,
      kpbFee,
      isKpbExempt,
      tripLevelNote,
    });
  }

  return results;
}

export function effectiveUnloadFee(row: {
  unloadFee: number;
  unloadFeeOverride: number | null;
}) {
  return row.unloadFeeOverride ?? row.unloadFee;
}

export function effectiveKpbFee(row: {
  kpbFee: number;
  kpbFeeOverride: number | null;
  isKpbExempt: boolean;
}) {
  if (row.isKpbExempt) return 0;
  return row.kpbFeeOverride ?? row.kpbFee;
}

export function lineSubtotal(row: {
  unloadFee: number;
  kpbFee: number;
  unloadFeeOverride: number | null;
  kpbFeeOverride: number | null;
  isKpbExempt: boolean;
}) {
  return roundMoney(
    effectiveUnloadFee(row) + effectiveKpbFee(row)
  );
}
