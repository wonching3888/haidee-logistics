import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { DEFAULT_FUEL_PRICES } from "@/lib/constants/truck-cost";
import { convertThbToMyr } from "@/lib/freight-rates";
import {
  calcFuelCostPerKm,
  calcTotalCostPerKm,
} from "@/lib/truck-cost";

import type { InboundFreightGapReason } from "@/lib/inbound-freight";
import type { OperationsIncomeWarningSample } from "@/lib/operations-income";

export type DataSourceKind = "actual" | "estimate";

export interface MetricLine {
  key: string;
  label: string;
  labelEn: string;
  amountMyr: number;
  source: DataSourceKind;
  detail?: string;
}

export interface OperationsRevenueWarning {
  missingRateLineCount: number;
  missingRateQuantity: number;
  gapReasons: Partial<Record<InboundFreightGapReason, number>>;
  samples: OperationsIncomeWarningSample[];
}

export interface OperationsDashboardData {
  year: number;
  month: number;
  yearMonth: string;
  exchangeRate: number;
  exchangeRateMissing: boolean;
  revenue: {
    mode1aThb: number;
    mode1aMyr: number;
    mode1bMyr: number;
    mode2Myr: number;
    haideeTotalMyr: number;
    wtlMode3Myr: number;
    totalMyr: number;
    lines: MetricLine[];
    warning: OperationsRevenueWarning | null;
  };
  costs: {
    lines: MetricLine[];
    subtotalMyr: number;
  };
  grossProfitMyr: number;
  tripCosts: {
    fuelMyr: number;
    maintenanceMyr: number;
    tollFee: number;
    fishCheckingFee: number;
    parkingFee: number;
    borderPass: number;
    epermit: number;
    dagangNet: number;
    forwarding: number;
    crateRental: number;
    loadUnloadFee: number;
    tripCount: number;
    totalMileageKm: number;
    routeCount: number;
  };
  lkimMaqis: {
    totalAmountMyr: number;
    totalCrates: number;
    ratePerCrate: number;
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function thbToMyr(amountThb: number, exchangeRate: number) {
  return roundMoney(convertThbToMyr(amountThb, exchangeRate));
}

export function estimateTruckMonthlyCosts(input: {
  trucks: {
    country: string;
    active: boolean;
    annualMileageKm: number | null;
    fuelEfficiencyKmPerL: number | null;
    costItems: { annualAmount: number }[];
  }[];
  fuelPriceMyr: number;
}) {
  let fuelTotal = 0;
  let maintenanceTotal = 0;
  let truckCount = 0;

  for (const truck of input.trucks) {
    if (!truck.active || truck.country !== "MY") continue;
    if (!truck.annualMileageKm || truck.annualMileageKm <= 0) continue;

    truckCount += 1;
    const monthlyKm = truck.annualMileageKm / 12;
    const fuelPerKm = calcFuelCostPerKm(
      input.fuelPriceMyr,
      truck.fuelEfficiencyKmPerL
    );
    if (fuelPerKm != null) {
      fuelTotal += monthlyKm * fuelPerKm;
    }

    const fixedPerKm = calcTotalCostPerKm(
      truck.costItems,
      truck.annualMileageKm
    );
    if (fixedPerKm != null) {
      maintenanceTotal += monthlyKm * fixedPerKm;
    }
  }

  return {
    fuelMyr: roundMoney(fuelTotal),
    maintenanceMyr: roundMoney(maintenanceTotal),
    truckCount,
  };
}

export function buildOperationsDashboardMetrics(input: {
  year: number;
  month: number;
  yearMonth: string;
  exchangeRate: number;
  exchangeRateMissing: boolean;
  income: {
    mode1aThb: number;
    mode1bMyr: number;
    mode2Myr: number;
    wtlMode3Myr: number;
    missingRateLineCount: number;
    missingRateQuantity: number;
    gapReasons: Partial<Record<InboundFreightGapReason, number>>;
    warningSamples: OperationsIncomeWarningSample[];
  };
  payroll: {
    netMyr: number;
    employerMyr: number;
    totalMyr: number;
    hasRecords: boolean;
  };
  mcThirdPartyMyr: number;
  tripCosts: {
    fuelMyr: number;
    maintenanceMyr: number;
    tollFee: number;
    fishCheckingFee: number;
    parkingFee: number;
    borderPass: number;
    epermit: number;
    dagangNet: number;
    forwarding: number;
    crateRental: number;
    loadUnloadFee: number;
    tripCount: number;
    totalMileageKm: number;
    routeCount: number;
  };
  lkimMaqis: {
    totalAmountMyr: number;
    totalCrates: number;
    ratePerCrate: number;
  };
}): OperationsDashboardData {
  const mode1aMyr = thbToMyr(input.income.mode1aThb, input.exchangeRate);
  const haideeTotalMyr = roundMoney(
    mode1aMyr + input.income.mode1bMyr + input.income.mode2Myr
  );
  const totalRevenueMyr = roundMoney(
    haideeTotalMyr + input.income.wtlMode3Myr
  );

  const revenueLines: MetricLine[] = [
    {
      key: "mode1a",
      label: "海利收入 - 寄货人付（THB）",
      labelEn: "HAIDEE Revenue - Shipper Paid (THB)",
      amountMyr: mode1aMyr,
      source: "actual",
      detail: `THB ${input.income.mode1aThb.toFixed(2)} ÷ ${input.exchangeRate}`,
    },
    {
      key: "mode1b",
      label: "海利收入 - 寄货人付（MYR）",
      labelEn: "HAIDEE Revenue - Shipper Paid (MYR)",
      amountMyr: input.income.mode1bMyr,
      source: "actual",
    },
    {
      key: "mode2",
      label: "海利收入 - 收货人付（MYR）",
      labelEn: "HAIDEE Revenue - Consignee Paid (MYR)",
      amountMyr: input.income.mode2Myr,
      source: "actual",
    },
    {
      key: "haidee",
      label: "海利总收入",
      labelEn: "HAIDEE Total Revenue",
      amountMyr: haideeTotalMyr,
      source: "actual",
    },
    {
      key: "mode3",
      label: "WTL收入 - 收货人付（MYR含SST）",
      labelEn: "WTL Revenue - Consignee Paid (MYR incl. SST)",
      amountMyr: input.income.wtlMode3Myr,
      source: "actual",
    },
  ];

  const costLines: MetricLine[] = [
    {
      key: "payroll",
      label: "马来西亚司机薪资",
      labelEn: "Driver Payroll",
      amountMyr: input.payroll.totalMyr,
      source: input.payroll.hasRecords ? "actual" : "estimate",
      detail: `实发 ${input.payroll.netMyr.toFixed(2)} + 雇主供款 ${input.payroll.employerMyr.toFixed(2)}`,
    },
    {
      key: "fuel",
      label: "车辆油费",
      labelEn: "Vehicle Fuel",
      amountMyr: input.tripCosts.fuelMyr,
      source: "estimate",
      detail:
        input.tripCosts.tripCount > 0
          ? `${input.tripCosts.tripCount} 趟 · 最高路线里程 ${input.tripCosts.totalMileageKm.toFixed(0)} km`
          : "当月无派车趟次",
    },
    {
      key: "maintenance",
      label: "维修/保险摊算",
      labelEn: "Maintenance & Insurance",
      amountMyr: input.tripCosts.maintenanceMyr,
      source: "estimate",
      detail: "实际派车里程 × 车辆 RM/km",
    },
    {
      key: "toll",
      label: "过路费 Toll",
      labelEn: "Toll",
      amountMyr: input.tripCosts.tollFee,
      source: "estimate",
      detail:
        input.tripCosts.tripCount > 0
          ? `${input.tripCosts.tripCount} 趟 · 路线最高 toll`
          : "当月无派车趟次",
    },
    {
      key: "fishChecking",
      label: "Fish Checking Fee",
      labelEn: "Fish Checking Fee",
      amountMyr: input.tripCosts.fishCheckingFee,
      source: "estimate",
      detail: "涉及路线 fish_checking_fee 加总",
    },
    {
      key: "parking",
      label: "Parking Fee",
      labelEn: "Parking Fee",
      amountMyr: input.tripCosts.parkingFee,
      source: "estimate",
      detail: "涉及路线 parking_fee 加总",
    },
    {
      key: "borderPass",
      label: "Border Pass",
      labelEn: "Border Pass",
      amountMyr: input.tripCosts.borderPass,
      source: "estimate",
      detail: "每趟固定 · global_cost_settings",
    },
    {
      key: "epermit",
      label: "EPERMIT",
      labelEn: "EPERMIT",
      amountMyr: input.tripCosts.epermit,
      source: "estimate",
      detail: "每趟固定 · global_cost_settings",
    },
    {
      key: "dagangNet",
      label: "Dagang Net",
      labelEn: "Dagang Net",
      amountMyr: input.tripCosts.dagangNet,
      source: "estimate",
      detail: "每趟固定 · global_cost_settings",
    },
    {
      key: "forwarding",
      label: "Forwarding（Zaewe）",
      labelEn: "Forwarding (Zaewe)",
      amountMyr: input.tripCosts.forwarding,
      source: "estimate",
      detail: "每趟 outbound · global_cost_settings",
    },
    {
      key: "crateRental",
      label: "租桶费",
      labelEn: "Crate Rental",
      amountMyr: input.tripCosts.crateRental,
      source: "actual",
      detail: "租桶型 × 市场租桶费率",
    },
    {
      key: "loadUnload",
      label: "Load/Unload费",
      labelEn: "Load / Unload",
      amountMyr: input.tripCosts.loadUnloadFee,
      source: "estimate",
      detail: "桶数 × 市场 Load/Unload 费率",
    },
    {
      key: "lkimMaqis",
      label: "LKIM-MAQIS费",
      labelEn: "LKIM-MAQIS",
      amountMyr: input.lkimMaqis.totalAmountMyr,
      source: "estimate",
      detail: `${(input.lkimMaqis.totalCrates ?? 0).toLocaleString("en-MY")} 桶 × RM ${(input.lkimMaqis.ratePerCrate ?? 0).toFixed(2)} = RM ${(input.lkimMaqis.totalAmountMyr ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      key: "mcThirdParty",
      label: "MC第三方费用",
      labelEn: "MC Third Party",
      amountMyr: input.mcThirdPartyMyr,
      source: "actual",
    },
  ];

  const subtotalMyr = roundMoney(
    costLines.reduce((sum, line) => sum + line.amountMyr, 0)
  );

  const revenueWarning: OperationsRevenueWarning | null =
    input.income.missingRateLineCount > 0
      ? {
          missingRateLineCount: input.income.missingRateLineCount,
          missingRateQuantity: input.income.missingRateQuantity,
          gapReasons: input.income.gapReasons,
          samples: input.income.warningSamples,
        }
      : null;

  return {
    year: input.year,
    month: input.month,
    yearMonth: input.yearMonth,
    exchangeRate: input.exchangeRate,
    exchangeRateMissing: input.exchangeRateMissing,
    revenue: {
      mode1aThb: input.income.mode1aThb,
      mode1aMyr,
      mode1bMyr: input.income.mode1bMyr,
      mode2Myr: input.income.mode2Myr,
      haideeTotalMyr,
      wtlMode3Myr: input.income.wtlMode3Myr,
      totalMyr: totalRevenueMyr,
      lines: revenueLines,
      warning: revenueWarning,
    },
    costs: {
      lines: costLines,
      subtotalMyr,
    },
    grossProfitMyr: roundMoney(totalRevenueMyr - subtotalMyr),
    tripCosts: input.tripCosts,
    lkimMaqis: input.lkimMaqis,
  };
}

export { DEFAULT_EXCHANGE_RATE, DEFAULT_FUEL_PRICES };
