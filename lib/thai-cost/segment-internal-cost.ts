import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import {
  resolveSessionPickupLocation,
  type PickupLocation,
} from "@/lib/constants/pickup-locations";
import { parseThaiSegmentRates } from "@/lib/constants/thai-segment-rates";
import { yearMonthKey } from "@/lib/constants/thai-cost";
import { decimalToNumber } from "@/lib/freight-rates";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import { fetchOperationsAssignedInboundLines } from "@/lib/operations-inbound-lines";
import { prisma } from "@/lib/prisma";
import { computeLineThaiSegmentCostMyr } from "@/lib/thai-segment-freight";
import { lockThaiCostRatesForMonth } from "@/lib/thai-cost/rate-settings";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export async function computeThaiSegmentInternalCostByPickup(
  year: number,
  month: number
): Promise<{
  byPickup: Record<"SONGKHLA" | "PATTANI", number>;
  exchangeRate: number;
  rates: ReturnType<typeof parseThaiSegmentRates>;
  lineCounts: Record<"SONGKHLA" | "PATTANI", number>;
}> {
  const yearMonth = yearMonthKey(year, month);
  const [globalCosts, exchangeRateRow, lines] = await Promise.all([
    listGlobalCostSettings(),
    prisma.exchangeRate.findUnique({ where: { yearMonth } }),
    fetchOperationsAssignedInboundLines(year, month),
  ]);

  const rates = parseThaiSegmentRates(globalCosts);
  const exchangeRate =
    decimalToNumber(exchangeRateRow?.rate) ?? DEFAULT_EXCHANGE_RATE;

  const byPickup = { SONGKHLA: 0, PATTANI: 0 };
  const lineCounts = { SONGKHLA: 0, PATTANI: 0 };

  for (const line of lines) {
    const marketCode = line.stall?.market?.code ?? "";
    const quantity = decimalToNumber(line.quantity) ?? 0;
    if (quantity <= 0) continue;

    const pickup = resolveSessionPickupLocation(
      line.session.pickupLocation,
      line.session.shipper.pickupLocation
    );
    if (pickup !== "SONGKHLA" && pickup !== "PATTANI") continue;

    const costMyr = computeLineThaiSegmentCostMyr({
      pickupLocation: pickup,
      quantity,
      isBox: line.tongType?.isBox ?? false,
      freightAmount: line.freightAmount,
      currency: line.currency,
      paymentMode: line.paymentMode,
      exchangeRate,
      rates,
      marketCode,
    });

    if (costMyr > 0) {
      byPickup[pickup] = roundMoney(byPickup[pickup] + costMyr);
      lineCounts[pickup] += 1;
    }
  }

  return { byPickup, exchangeRate, rates, lineCounts };
}

/**
 * Lock monthly handling/driver rates + Thai-segment internal cost snapshots.
 * Does not overwrite existing snapshots unless force=true.
 */
export async function lockThaiMonthSnapshots(input: {
  year: number;
  month: number;
  createdBy: string;
  force?: boolean;
  pickups?: Array<"SONGKHLA" | "PATTANI">;
}) {
  const ym = yearMonthKey(input.year, input.month);
  const pickups = input.pickups ?? ["SONGKHLA", "PATTANI"];

  const rateSnap = await lockThaiCostRatesForMonth({
    year: input.year,
    month: input.month,
    createdBy: input.createdBy,
    force: input.force,
  });

  const computed = await computeThaiSegmentInternalCostByPickup(
    input.year,
    input.month
  );

  const ratesUsedSnapshot = {
    exchangeRate: computed.exchangeRate,
    songkhlaRateTong: computed.rates.songkhlaRateTong,
    songkhlaRateBox: computed.rates.songkhlaRateBox,
    pattaniRateTong: computed.rates.pattaniRateTong,
    pattaniRateBox: computed.rates.pattaniRateBox,
    handlingSmallWeekday: rateSnap.handlingSmallWeekday,
    handlingSmallHoliday: rateSnap.handlingSmallHoliday,
    handlingLargeWeekday: rateSnap.handlingLargeWeekday,
    handlingLargeHoliday: rateSnap.handlingLargeHoliday,
    driverTripSongkhla: rateSnap.driverTripSongkhla,
    driverTripPattani: rateSnap.driverTripPattani,
    pattaniContractorCrate: rateSnap.pattaniContractorCrate,
    pattaniContractorBox: rateSnap.pattaniContractorBox,
    pattaniSakriCrate: rateSnap.pattaniSakriCrate,
    lineCounts: computed.lineCounts,
  };

  const results: Array<{
    pickupLocation: PickupLocation;
    totalAmountMyr: number;
    created: boolean;
  }> = [];

  for (const pickup of pickups) {
    const existing = await prisma.thaiSegmentInternalCostSnapshot.findUnique({
      where: {
        yearMonth_pickupLocation: { yearMonth: ym, pickupLocation: pickup },
      },
    });

    if (existing && !input.force) {
      results.push({
        pickupLocation: pickup,
        totalAmountMyr: decimalToNumber(existing.totalAmountMyr) ?? 0,
        created: false,
      });
      continue;
    }

    const totalAmountMyr = computed.byPickup[pickup];
    const data = {
      totalAmountMyr,
      ratesUsedSnapshot,
      snapshotAt: new Date(),
      createdBy: input.createdBy,
    };

    if (existing) {
      await prisma.thaiSegmentInternalCostSnapshot.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.thaiSegmentInternalCostSnapshot.create({
        data: {
          yearMonth: ym,
          pickupLocation: pickup,
          ...data,
        },
      });
    }

    results.push({
      pickupLocation: pickup,
      totalAmountMyr,
      created: true,
    });
  }

  return { yearMonth: ym, rateSnap, segmentSnapshots: results };
}

export async function getSegmentInternalCostSnapshot(
  year: number,
  month: number,
  pickupLocation: "SONGKHLA" | "PATTANI"
) {
  const ym = yearMonthKey(year, month);
  return prisma.thaiSegmentInternalCostSnapshot.findUnique({
    where: {
      yearMonth_pickupLocation: { yearMonth: ym, pickupLocation },
    },
  });
}
