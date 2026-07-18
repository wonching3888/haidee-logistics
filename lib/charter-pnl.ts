import {
  computeCharterEffectiveBorderFeesMyr,
  resolveCharterEffectiveBorderPass,
  resolveCharterEffectiveOther,
  resolveCharterEffectiveUnload,
  resolveCharterLoadingLabor,
  type CharterVoucherCostContext,
} from "@/lib/charter-voucher-cost-resolver";
import { resolveCharterDriverSalaryMyr } from "@/lib/charter-payroll-salary";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  computeTripTruckCosts,
  type GlobalTripCostValues,
} from "@/lib/operations-cost";
import { toDateInputValue } from "@/lib/date-utils";
import type { PnlShipperRow, PnlTripRow, PnlTripVehicleCosts } from "@/lib/pnl-report-types";

export const CHARTER_PNL_ROUTE_GROUP = "CHARTER";
export const CHARTER_PNL_MARKET_CODE = "CHARTER";
export const CHARTER_MANUAL_CUSTOMER_PREFIX = "manual:";
export const CHARTER_UNSPECIFIED_CUSTOMER_ID = "charter:unspecified";
export const CHARTER_UNSPECIFIED_CUSTOMER_NAME = "未指定客户";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function normalizeCharterBillToKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function charterManualCustomerId(name: string): string {
  return `${CHARTER_MANUAL_CUSTOMER_PREFIX}${normalizeCharterBillToKey(name)}`;
}

export function isCharterManualCustomerId(shipperId: string): boolean {
  return shipperId.startsWith(CHARTER_MANUAL_CUSTOMER_PREFIX);
}

export function charterRouteLabel(charterNo: string | null): string {
  return charterNo ? `${charterNo} 包车` : "包车 Charter";
}

export interface CharterTripPnlInput {
  id: string;
  charterNo: string | null;
  date: Date;
  driverName: string | null;
  shipperId: string | null;
  billToCustomerName: string | null;
  includeBorderFees: boolean;
  charterMileageKm: unknown;
  charterRevenueMyr: unknown;
  charterUnloadFeeMyr: unknown;
  charterUnloadFeeOverride: unknown;
  charterBorderPassOverride: unknown;
  charterDriverSalaryMyr: unknown;
  charterOtherCostMyr: unknown;
  charterOtherCostOverride: unknown;
  charterLoadingLaborMyr: unknown;
  charterTollMyr: unknown;
  totalQuantity: number | null;
  computedLkimMyr: unknown;
  computedCrateRentalMyr: unknown;
  /** When set (including 0), driver salary comes from payroll sync. */
  payrollCharterSalaryMyr?: number;
  truck: {
    plate: string;
    fuelEfficiencyKmPerL: unknown;
    annualMileageKm: number | null;
    costItems: Array<{ annualAmount: unknown }>;
  };
  shipper?: { id: string; code: string; name: string } | null;
  extraItems: Array<{ itemType: string; amountMyr: unknown }>;
}

export function resolveCharterPnlCustomer(trip: CharterTripPnlInput): {
  shipperId: string;
  shipperCode: string;
  shipperName: string;
} {
  if (trip.shipper) {
    return {
      shipperId: trip.shipper.id,
      shipperCode: trip.shipper.code,
      shipperName: trip.shipper.name,
    };
  }
  const billTo = trip.billToCustomerName?.trim();
  if (billTo) {
    return {
      shipperId: charterManualCustomerId(billTo),
      shipperCode: billTo,
      shipperName: billTo,
    };
  }
  return {
    shipperId: CHARTER_UNSPECIFIED_CUSTOMER_ID,
    shipperCode: "—",
    shipperName: CHARTER_UNSPECIFIED_CUSTOMER_NAME,
  };
}

export function computeCharterPnlRow(
  trip: CharterTripPnlInput,
  globalCosts: GlobalTripCostValues,
  voucher?: CharterVoucherCostContext | null
): PnlTripRow | null {
  const totalQuantity = trip.totalQuantity ?? 0;
  if (totalQuantity <= 0) return null;

  const baseRevenue = decimalToNumber(trip.charterRevenueMyr) ?? 0;
  let extraRevenueMyr = 0;
  let extraCostMyr = 0;
  for (const item of trip.extraItems) {
    const amount = decimalToNumber(item.amountMyr) ?? 0;
    if (amount <= 0) continue;
    if (item.itemType === "revenue") extraRevenueMyr += amount;
    if (item.itemType === "cost") extraCostMyr += amount;
  }
  extraRevenueMyr = roundMoney(extraRevenueMyr);
  extraCostMyr = roundMoney(extraCostMyr);

  const revenueMyr = roundMoney(baseRevenue + extraRevenueMyr);
  if (revenueMyr <= 0) return null;

  const lkimMyr = decimalToNumber(trip.computedLkimMyr) ?? 0;
  const crateRentalMyr = decimalToNumber(trip.computedCrateRentalMyr) ?? 0;
  const unloadFeeMyr = resolveCharterEffectiveUnload({
    charterUnloadFeeMyr: trip.charterUnloadFeeMyr,
    charterUnloadFeeOverride: trip.charterUnloadFeeOverride,
    voucher,
  });
  const { driverSalaryMyr } = resolveCharterDriverSalaryMyr(
    trip,
    trip.payrollCharterSalaryMyr,
    { warnOnFallback: true }
  );
  const otherCostMyr = resolveCharterEffectiveOther({
    charterOtherCostMyr: trip.charterOtherCostMyr,
    charterOtherCostOverride: trip.charterOtherCostOverride,
    voucher,
  });
  const loadingLaborMyr = resolveCharterLoadingLabor({
    charterLoadingLaborMyr: trip.charterLoadingLaborMyr,
    voucher,
  });
  const tollMyr = decimalToNumber(trip.charterTollMyr) ?? 0;
  const mileageKm = decimalToNumber(trip.charterMileageKm) ?? 0;

  const truckCosts = computeTripTruckCosts(
    mileageKm,
    {
      fuelEfficiencyKmPerL: decimalToNumber(trip.truck.fuelEfficiencyKmPerL),
      annualMileageKm: trip.truck.annualMileageKm,
      costItems: trip.truck.costItems.map((item) => ({
        annualAmount: decimalToNumber(item.annualAmount) ?? 0,
      })),
    },
    globalCosts.fuelPriceMyr
  );

  const borderPassMyr = resolveCharterEffectiveBorderPass({
    includeBorderFees: trip.includeBorderFees,
    charterBorderPassOverride: trip.charterBorderPassOverride,
    globalCosts,
    voucher,
  });
  const epermitMyr = trip.includeBorderFees ? globalCosts.epermit : 0;
  const dagangNetMyr = trip.includeBorderFees ? globalCosts.dagangNet : 0;
  const forwardingMyr = trip.includeBorderFees
    ? globalCosts.forwardingOutbound
    : 0;
  const borderFeesMyr = computeCharterEffectiveBorderFeesMyr({
    includeBorderFees: trip.includeBorderFees,
    charterBorderPassOverride: trip.charterBorderPassOverride,
    globalCosts,
    voucher,
  });

  const shipperDirectCoreMyr = roundMoney(
    lkimMyr + crateRentalMyr + driverSalaryMyr + extraCostMyr + otherCostMyr
  );
  const allocatedCostMyr = roundMoney(
    truckCosts.fuelMyr +
      truckCosts.maintenanceMyr +
      tollMyr +
      borderFeesMyr
  );
  const directCostMyr = roundMoney(
    shipperDirectCoreMyr + unloadFeeMyr + loadingLaborMyr
  );
  const totalCostMyr = roundMoney(directCostMyr + allocatedCostMyr);
  const grossProfitMyr = roundMoney(revenueMyr - totalCostMyr);
  const marginPct =
    revenueMyr > 0 ? roundMoney((grossProfitMyr / revenueMyr) * 100) : 0;

  const customer = resolveCharterPnlCustomer(trip);

  const vehicleCosts: PnlTripVehicleCosts = {
    fuelMyr: truckCosts.fuelMyr,
    maintenanceMyr: truckCosts.maintenanceMyr,
    tollMyr,
    borderPassMyr,
    epermitMyr,
    dagangNetMyr,
    forwardingMyr,
    driverMyr: 0,
    totalMyr: allocatedCostMyr,
  };

  const shipper: PnlShipperRow = {
    shipperId: customer.shipperId,
    shipperCode: customer.shipperCode,
    shipperName: customer.shipperName,
    quantity: totalQuantity,
    barrelQty: totalQuantity,
    boxQty: 0,
    revenueMyr,
    crateRentalMyr,
    lkimMaqisMyr: lkimMyr,
    thaiSegmentMyr: 0,
    unloadFeeMyr,
    loadingLaborMyr,
    mcThirdPartyHaulageMyr: 0,
    driverSalaryMyr,
    directCostMyr: shipperDirectCoreMyr,
    allocatedFuelMyr: truckCosts.fuelMyr,
    allocatedMaintenanceMyr: truckCosts.maintenanceMyr,
    allocatedTollMyr: tollMyr,
    allocatedBorderPassMyr: borderPassMyr,
    allocatedEpermitMyr: epermitMyr,
    allocatedDagangNetMyr: dagangNetMyr,
    allocatedForwardingMyr: forwardingMyr,
    allocatedDriverMyr: 0,
    allocatedCostMyr,
    sadaoHandlingMyr: 0,
    totalCostMyr,
    grossProfitMyr,
    marginPct,
  };

  const routeLabel = charterRouteLabel(trip.charterNo);

  return {
    tripSource: "charter",
    dispatchOrderId: trip.id,
    date: toDateInputValue(trip.date),
    routeKey: CHARTER_PNL_ROUTE_GROUP,
    routeLabel,
    routeGroups: [CHARTER_PNL_ROUTE_GROUP],
    driverName: trip.driverName,
    truckPlate: trip.truck.plate,
    totalQuantity,
    totalBarrelQty: totalQuantity,
    totalBoxQty: 0,
    revenueMyr,
    directCostMyr,
    allocatedCostMyr,
    totalCostMyr,
    grossProfitMyr,
    marginPct,
    vehicleCosts,
    shippers: [shipper],
  };
}

export const charterTripPnlSelect = {
  id: true,
  charterNo: true,
  date: true,
  driverName: true,
  shipperId: true,
  billToCustomerName: true,
  includeBorderFees: true,
  charterMileageKm: true,
  charterRevenueMyr: true,
  charterUnloadFeeMyr: true,
  charterUnloadFeeOverride: true,
  charterBorderPassOverride: true,
  charterDriverSalaryMyr: true,
  charterOtherCostMyr: true,
  charterOtherCostOverride: true,
  charterLoadingLaborMyr: true,
  charterTollMyr: true,
  totalQuantity: true,
  computedLkimMyr: true,
  computedCrateRentalMyr: true,
  truck: {
    select: {
      plate: true,
      fuelEfficiencyKmPerL: true,
      annualMileageKm: true,
      costItems: { select: { annualAmount: true } },
    },
  },
  shipper: { select: { id: true, code: true, name: true } },
  extraItems: { select: { itemType: true, amountMyr: true } },
} as const;
