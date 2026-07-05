/**
 * Soft cross-check: manual vehicle trip crate totals vs dispatch auto totals.
 * Non-blocking — returns a warning message when gap exceeds threshold.
 */
import type { PickupLocation } from "@/lib/constants/pickup-locations";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import {
  aggregateDispatchCrateTotalForMonth,
  crateBucketTotal,
} from "@/lib/thai-cost/dispatch-crate-aggregate";

/** Minimum absolute gap before showing a warning. */
export const DISPATCH_CROSS_CHECK_THRESHOLD = 5;

export interface DispatchCrossCheckResult {
  manualTotal: number;
  dispatchTotal: number;
  gap: number;
  exceedsThreshold: boolean;
  message: string | null;
}

const STATION_LABEL: Record<PickupLocation, string> = {
  SONGKHLA: "宋卡",
  PATTANI: "北大年",
  SADAO: "Sadao",
};

export async function compareManualVsDispatchCrates(input: {
  year: number;
  month: number;
  station: "SONGKHLA" | "PATTANI";
  largeTongTypeCodes: string[];
  threshold?: number;
}): Promise<DispatchCrossCheckResult> {
  const threshold = input.threshold ?? DISPATCH_CROSS_CHECK_THRESHOLD;
  const { start, end } = getMonthDateRange(input.year, input.month);

  const vehicleTrips = await prisma.thaiVehicleTripDaily.findMany({
    where: {
      station: input.station,
      date: { gte: start, lte: end },
    },
    select: { tongQty: true, boxQty: true },
  });

  const manualTotal = vehicleTrips.reduce(
    (sum, t) => sum + t.tongQty + t.boxQty,
    0
  );

  const dispatchTotal = await aggregateDispatchCrateTotalForMonth(
    input.year,
    input.month,
    input.station,
    input.largeTongTypeCodes
  );

  const gap = Math.abs(manualTotal - dispatchTotal);
  const exceedsThreshold = gap > threshold;
  const label = STATION_LABEL[input.station];

  const message = exceedsThreshold
    ? `${label}据点：手动登记合计 ${manualTotal} 桶，系统派车记录合计 ${dispatchTotal} 桶，相差 ${gap} 桶，建议核对是否有遗漏登记的车次。`
    : null;

  return {
    manualTotal,
    dispatchTotal,
    gap,
    exceedsThreshold,
    message,
  };
}

/** Sum manual vehicle trip crates for one day at a station. */
export function sumManualVehicleCratesForDay(
  trips: Array<{ tongQty: number; boxQty: number }>
): number {
  return trips.reduce((s, t) => s + t.tongQty + t.boxQty, 0);
}

export { crateBucketTotal };
