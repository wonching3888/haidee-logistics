import { aggregateDispatchCratesForDate } from "@/lib/thai-cost/dispatch-crate-aggregate";
import type { ResolvedThaiCostRates } from "@/lib/thai-cost/rate-settings";

/** Live dispatch crate/box totals for a station pickup day. */
export async function fetchLiveStationDispatchTotals(
  date: Date,
  pickup: "SONGKHLA" | "PATTANI",
  largeTongTypeCodes: readonly string[]
) {
  return aggregateDispatchCratesForDate(date, {
    pickupFilter: pickup,
    largeTongTypeCodes: [...largeTongTypeCodes],
  });
}

export async function resolveSongkhlaEffectiveQty(
  row: {
    date: Date;
    manualQty: boolean;
    smallCrateTotalQty: number;
    largeCrateTotalQty: number;
    boxTotalQty: number;
  },
  rates: Pick<ResolvedThaiCostRates, "largeTongTypeCodes">
) {
  if (row.manualQty) {
    return {
      smallCrateTotalQty: row.smallCrateTotalQty,
      largeCrateTotalQty: row.largeCrateTotalQty,
      boxTotalQty: row.boxTotalQty,
    };
  }
  const live = await fetchLiveStationDispatchTotals(
    row.date,
    "SONGKHLA",
    rates.largeTongTypeCodes
  );
  return {
    smallCrateTotalQty: live.small,
    largeCrateTotalQty: live.large,
    boxTotalQty: live.box,
  };
}

export async function resolvePattaniEffectiveQty(
  row: {
    date: Date;
    manualQty: boolean;
    crateQty: number;
    boxQty: number;
  },
  rates: Pick<ResolvedThaiCostRates, "largeTongTypeCodes">
) {
  if (row.manualQty) {
    return { crateQty: row.crateQty, boxQty: row.boxQty };
  }
  const live = await fetchLiveStationDispatchTotals(
    row.date,
    "PATTANI",
    rates.largeTongTypeCodes
  );
  return {
    crateQty: live.small + live.large,
    boxQty: live.box,
  };
}

/** Batch-resolve Songkhla rows (live dispatch only for non-manual days). */
export async function resolveSongkhlaEffectiveQtyMap(
  rows: Array<{
    id: string;
    date: Date;
    manualQty: boolean;
    smallCrateTotalQty: number;
    largeCrateTotalQty: number;
    boxTotalQty: number;
  }>,
  rates: Pick<ResolvedThaiCostRates, "largeTongTypeCodes">
) {
  const out = new Map<
    string,
    {
      smallCrateTotalQty: number;
      largeCrateTotalQty: number;
      boxTotalQty: number;
    }
  >();
  await Promise.all(
    rows.map(async (row) => {
      out.set(row.id, await resolveSongkhlaEffectiveQty(row, rates));
    })
  );
  return out;
}

export async function resolvePattaniEffectiveQtyMap(
  rows: Array<{
    id: string;
    date: Date;
    manualQty: boolean;
    crateQty: number;
    boxQty: number;
  }>,
  rates: Pick<ResolvedThaiCostRates, "largeTongTypeCodes">
) {
  const out = new Map<string, { crateQty: number; boxQty: number }>();
  await Promise.all(
    rows.map(async (row) => {
      out.set(row.id, await resolvePattaniEffectiveQty(row, rates));
    })
  );
  return out;
}
