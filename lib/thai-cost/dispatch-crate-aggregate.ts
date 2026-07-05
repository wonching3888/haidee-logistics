/**
 * Aggregate assigned dispatch line quantities by crate bucket.
 * Used for Sadao auto-totals (scheme 1: all assigned, all pickups) and
 * station-specific cross-checks (filter by pickup).
 */
import {
  resolveSessionPickupLocation,
  type PickupLocation,
} from "@/lib/constants/pickup-locations";
import { toDateInputValue } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import { classifyThaiCostCrate } from "@/lib/thai-cost/crate-classify";
import type { ThaiCostRates } from "@/lib/thai-cost/rate-settings";

export type CrateBucketQty = {
  small: number;
  large: number;
  box: number;
};

export const EMPTY_CRATE_BUCKET: CrateBucketQty = {
  small: 0,
  large: 0,
  box: 0,
};

export function sumCrateBuckets(a: CrateBucketQty, b: CrateBucketQty): CrateBucketQty {
  return {
    small: a.small + b.small,
    large: a.large + b.large,
    box: a.box + b.box,
  };
}

export function crateBucketTotal(q: CrateBucketQty): number {
  return q.small + q.large + q.box;
}

function addBucket(target: CrateBucketQty, bucket: "small" | "large" | "box", qty: number) {
  target[bucket] += qty;
}

export type DispatchAggregateOptions = {
  /** When set, only lines with this pickup are counted. */
  pickupFilter?: PickupLocation;
  largeTongTypeCodes: string[];
};

/**
 * Aggregate dispatch crate qty for one calendar day.
 * Scheme 1: status≠cancelled dispatch, dispatchStatus=assigned, qty>0.
 */
export async function aggregateDispatchCratesForDate(
  date: Date,
  options: DispatchAggregateOptions
): Promise<CrateBucketQty> {
  const dayStart = new Date(date);
  const dayEnd = new Date(date);

  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { not: "cancelled" },
      date: { gte: dayStart, lte: dayEnd },
    },
    select: {
      lines: {
        select: {
          inboundLine: {
            select: {
              quantity: true,
              dispatchStatus: true,
              isBox: true,
              tongType: { select: { code: true, isBox: true } },
              session: {
                select: {
                  pickupLocation: true,
                  shipper: { select: { pickupLocation: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const result = { ...EMPTY_CRATE_BUCKET };
  const largeCodes = options.largeTongTypeCodes;

  for (const d of dispatches) {
    for (const dl of d.lines) {
      const line = dl.inboundLine;
      if (!line || line.dispatchStatus !== "assigned") continue;
      const qty = line.quantity ?? 0;
      if (qty <= 0) continue;

      if (options.pickupFilter) {
        const pickup = resolveSessionPickupLocation(
          line.session.pickupLocation,
          line.session.shipper.pickupLocation
        );
        if (pickup !== options.pickupFilter) continue;
      }

      const tongCode = line.tongType?.code ?? "";
      const isBox = line.tongType?.isBox ?? line.isBox ?? false;
      const bucket = classifyThaiCostCrate(tongCode, isBox, largeCodes);
      addBucket(result, bucket, qty);
    }
  }

  return result;
}

/** Aggregate dispatch crates for each day in [start, end] inclusive. */
export async function aggregateDispatchCratesForRange(
  start: Date,
  end: Date,
  options: DispatchAggregateOptions
): Promise<Map<string, CrateBucketQty>> {
  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { not: "cancelled" },
      date: { gte: start, lte: end },
    },
    select: {
      date: true,
      lines: {
        select: {
          inboundLine: {
            select: {
              quantity: true,
              dispatchStatus: true,
              isBox: true,
              tongType: { select: { code: true, isBox: true } },
              session: {
                select: {
                  pickupLocation: true,
                  shipper: { select: { pickupLocation: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  const byDate = new Map<string, CrateBucketQty>();
  const largeCodes = options.largeTongTypeCodes;

  for (const d of dispatches) {
    const dateKey = toDateInputValue(d.date);
    const day = byDate.get(dateKey) ?? { ...EMPTY_CRATE_BUCKET };

    for (const dl of d.lines) {
      const line = dl.inboundLine;
      if (!line || line.dispatchStatus !== "assigned") continue;
      const qty = line.quantity ?? 0;
      if (qty <= 0) continue;

      if (options.pickupFilter) {
        const pickup = resolveSessionPickupLocation(
          line.session.pickupLocation,
          line.session.shipper.pickupLocation
        );
        if (pickup !== options.pickupFilter) continue;
      }

      const tongCode = line.tongType?.code ?? "";
      const isBox = line.tongType?.isBox ?? line.isBox ?? false;
      const bucket = classifyThaiCostCrate(tongCode, isBox, largeCodes);
      addBucket(day, bucket, qty);
    }

    byDate.set(dateKey, day);
  }

  return byDate;
}

/** Sadao totals: all pickups (SONGKHLA + PATTANI + SADAO), all assigned. */
export async function aggregateSadaoDispatchTotalsForDate(
  date: Date,
  rateConfig: Pick<ThaiCostRates, "largeTongTypeCodes">
): Promise<CrateBucketQty> {
  return aggregateDispatchCratesForDate(date, {
    largeTongTypeCodes: rateConfig.largeTongTypeCodes,
  });
}

/** Month total crate count for a station pickup (for cross-check). */
export async function aggregateDispatchCrateTotalForMonth(
  year: number,
  month: number,
  pickup: PickupLocation,
  largeTongTypeCodes: string[]
): Promise<number> {
  const { getMonthDateRange } = await import(
    "@/lib/reports/period-report-shared"
  );
  const { start, end } = getMonthDateRange(year, month);
  const byDate = await aggregateDispatchCratesForRange(start, end, {
    pickupFilter: pickup,
    largeTongTypeCodes,
  });
  let total = 0;
  for (const buckets of Array.from(byDate.values())) {
    total += crateBucketTotal(buckets);
  }
  return total;
}
