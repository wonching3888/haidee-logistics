import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import {
  loadCharterVoucherContextByTripId,
  computeCharterEffectiveBorderFeesMyr,
  resolveCharterEffectiveOther,
  resolveCharterEffectiveUnload,
  resolveCharterLoadingLabor,
} from "@/lib/charter-voucher-cost-resolver";
import {
  computeTripTruckCosts,
  loadGlobalTripCostValues,
} from "@/lib/operations-cost";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export interface CharterOperationsIncomeTotals {
  charterRevenueMyr: number;
  charterBaseRevenueMyr: number;
  charterExtraRevenueMyr: number;
  charterTripCount: number;
}

export interface CharterOperationsCostTotals {
  charterVehicleCostMyr: number;
  charterFuelMyr: number;
  charterMaintenanceMyr: number;
  charterLkimMyr: number;
  charterCrateRentalMyr: number;
  charterUnloadFeeMyr: number;
  charterDriverSalaryMyr: number;
  charterTollMyr: number;
  charterExtraCostMyr: number;
  charterOtherCostMyr: number;
  charterBorderFeesMyr: number;
  charterLoadingLaborMyr: number;
  charterTripCount: number;
  charterMileageKm: number;
  charterTotalQuantity: number;
}

export function emptyCharterOperationsCostTotals(): CharterOperationsCostTotals {
  return {
    charterVehicleCostMyr: 0,
    charterFuelMyr: 0,
    charterMaintenanceMyr: 0,
    charterLkimMyr: 0,
    charterCrateRentalMyr: 0,
    charterUnloadFeeMyr: 0,
    charterDriverSalaryMyr: 0,
    charterTollMyr: 0,
    charterExtraCostMyr: 0,
    charterOtherCostMyr: 0,
    charterBorderFeesMyr: 0,
    charterLoadingLaborMyr: 0,
    charterTripCount: 0,
    charterMileageKm: 0,
    charterTotalQuantity: 0,
  };
}

export function charterOperationsCostGrandTotal(
  totals: CharterOperationsCostTotals
): number {
  return roundMoney(
    totals.charterVehicleCostMyr +
      totals.charterLkimMyr +
      totals.charterCrateRentalMyr +
      totals.charterUnloadFeeMyr +
      totals.charterTollMyr +
      totals.charterExtraCostMyr +
      totals.charterOtherCostMyr +
      totals.charterBorderFeesMyr +
      totals.charterLoadingLaborMyr
  );
}

export async function aggregateCharterOperationsIncome(
  year: number,
  month: number
): Promise<CharterOperationsIncomeTotals> {
  const { start, end } = getMonthDateRange(year, month);

  const trips = await prisma.charterTrip.findMany({
    where: { date: { gte: start, lte: end } },
    select: {
      charterRevenueMyr: true,
      extraItems: {
        where: { itemType: "revenue" },
        select: { amountMyr: true },
      },
    },
  });

  let charterBaseRevenueMyr = 0;
  let charterExtraRevenueMyr = 0;

  for (const trip of trips) {
    charterBaseRevenueMyr += decimalToNumber(trip.charterRevenueMyr) ?? 0;
    for (const item of trip.extraItems) {
      charterExtraRevenueMyr += decimalToNumber(item.amountMyr) ?? 0;
    }
  }

  return {
    charterRevenueMyr: roundMoney(
      charterBaseRevenueMyr + charterExtraRevenueMyr
    ),
    charterBaseRevenueMyr: roundMoney(charterBaseRevenueMyr),
    charterExtraRevenueMyr: roundMoney(charterExtraRevenueMyr),
    charterTripCount: trips.length,
  };
}

export async function aggregateCharterOperationsCosts(
  year: number,
  month: number
): Promise<CharterOperationsCostTotals> {
  const { start, end } = getMonthDateRange(year, month);

  const [trips, globalCosts] = await Promise.all([
    prisma.charterTrip.findMany({
      where: { date: { gte: start, lte: end } },
      include: {
        extraItems: {
          where: { itemType: "cost" },
          select: { amountMyr: true },
        },
        truck: {
          select: {
            fuelEfficiencyKmPerL: true,
            annualMileageKm: true,
            costItems: { select: { annualAmount: true } },
          },
        },
      },
    }),
    loadGlobalTripCostValues(),
  ]);

  const totals = emptyCharterOperationsCostTotals();
  const voucherByTripId = await loadCharterVoucherContextByTripId(
    trips.map((trip) => trip.id)
  );

  for (const trip of trips) {
    const mileage = decimalToNumber(trip.charterMileageKm) ?? 0;
    totals.charterMileageKm += mileage;
    totals.charterTotalQuantity += trip.totalQuantity ?? 0;

    const truckCosts = computeTripTruckCosts(
      mileage,
      {
        fuelEfficiencyKmPerL: decimalToNumber(trip.truck.fuelEfficiencyKmPerL),
        annualMileageKm: trip.truck.annualMileageKm,
        costItems: trip.truck.costItems.map((item) => ({
          annualAmount: decimalToNumber(item.annualAmount) ?? 0,
        })),
      },
      globalCosts.fuelPriceMyr
    );

    totals.charterFuelMyr += truckCosts.fuelMyr;
    totals.charterMaintenanceMyr += truckCosts.maintenanceMyr;
    totals.charterLkimMyr += decimalToNumber(trip.computedLkimMyr) ?? 0;
    totals.charterCrateRentalMyr +=
      decimalToNumber(trip.computedCrateRentalMyr) ?? 0;
    totals.charterUnloadFeeMyr += resolveCharterEffectiveUnload({
      charterUnloadFeeMyr: trip.charterUnloadFeeMyr,
      charterUnloadFeeOverride: trip.charterUnloadFeeOverride,
      voucher: voucherByTripId.get(trip.id),
    });
    totals.charterTollMyr += decimalToNumber(trip.charterTollMyr) ?? 0;
    totals.charterOtherCostMyr += resolveCharterEffectiveOther({
      charterOtherCostMyr: trip.charterOtherCostMyr,
      charterOtherCostOverride: trip.charterOtherCostOverride,
      voucher: voucherByTripId.get(trip.id),
    });

    for (const item of trip.extraItems) {
      totals.charterExtraCostMyr += decimalToNumber(item.amountMyr) ?? 0;
    }

    totals.charterBorderFeesMyr += computeCharterEffectiveBorderFeesMyr({
      includeBorderFees: trip.includeBorderFees,
      charterBorderPassOverride: trip.charterBorderPassOverride,
      globalCosts,
      voucher: voucherByTripId.get(trip.id),
    });
    totals.charterLoadingLaborMyr += resolveCharterLoadingLabor({
      charterLoadingLaborMyr: trip.charterLoadingLaborMyr,
      voucher: voucherByTripId.get(trip.id),
    });
  }

  totals.charterTripCount = trips.length;
  totals.charterVehicleCostMyr = roundMoney(
    totals.charterFuelMyr + totals.charterMaintenanceMyr
  );
  totals.charterFuelMyr = roundMoney(totals.charterFuelMyr);
  totals.charterMaintenanceMyr = roundMoney(totals.charterMaintenanceMyr);
  totals.charterLkimMyr = roundMoney(totals.charterLkimMyr);
  totals.charterCrateRentalMyr = roundMoney(totals.charterCrateRentalMyr);
  totals.charterUnloadFeeMyr = roundMoney(totals.charterUnloadFeeMyr);
  totals.charterDriverSalaryMyr = 0;
  totals.charterTollMyr = roundMoney(totals.charterTollMyr);
  totals.charterExtraCostMyr = roundMoney(totals.charterExtraCostMyr);
  totals.charterOtherCostMyr = roundMoney(totals.charterOtherCostMyr);
  totals.charterBorderFeesMyr = roundMoney(totals.charterBorderFeesMyr);
  totals.charterLoadingLaborMyr = roundMoney(totals.charterLoadingLaborMyr);
  totals.charterMileageKm = roundMoney(totals.charterMileageKm);

  return totals;
}
