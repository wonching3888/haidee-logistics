import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { DEFAULT_FUEL_PRICES } from "@/lib/constants/truck-cost";
import { convertThbToMyr } from "@/lib/freight-rates";
import {
  calcFuelCostPerKm,
  calcTotalCostPerKm,
} from "@/lib/truck-cost";

export type DataSourceKind = "actual" | "estimate";

export interface MetricLine {
  key: string;
  label: string;
  labelEn: string;
  amountMyr: number;
  source: DataSourceKind;
  detail?: string;
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
  };
  costs: {
    lines: MetricLine[];
    subtotalMyr: number;
  };
  grossProfitMyr: number;
  manualCosts: {
    tollFee: number | null;
    crateRental: number | null;
    loadUnloadFee: number | null;
    lkimMaqisFee: number | null;
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
  };
  payrollNetMyr: number;
  payrollHasRecords: boolean;
  truckFuelMyr: number;
  truckMaintenanceMyr: number;
  truckEstimateCount: number;
  mcThirdPartyMyr: number;
  manualCosts: {
    tollFee: number;
    crateRental: number;
    loadUnloadFee: number;
    lkimMaqisFee: number;
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
      label: "模式1a (THB→MYR)",
      labelEn: "Mode 1a THB→MYR",
      amountMyr: mode1aMyr,
      source: "actual",
      detail: `THB ${input.income.mode1aThb.toFixed(2)} ÷ ${input.exchangeRate}`,
    },
    {
      key: "mode1b",
      label: "模式1b (MYR)",
      labelEn: "Mode 1b MYR",
      amountMyr: input.income.mode1bMyr,
      source: "actual",
    },
    {
      key: "mode2",
      label: "模式2 (MYR)",
      labelEn: "Mode 2 MYR",
      amountMyr: input.income.mode2Myr,
      source: "actual",
    },
    {
      key: "haidee",
      label: "海利收入小计",
      labelEn: "HAIDEE Subtotal",
      amountMyr: haideeTotalMyr,
      source: "actual",
    },
    {
      key: "mode3",
      label: "WTL收入 模式3 (MYR)",
      labelEn: "WTL Mode 3 MYR",
      amountMyr: input.income.wtlMode3Myr,
      source: "actual",
    },
  ];

  const costLines: MetricLine[] = [
    {
      key: "payroll",
      label: "马来西亚司机薪资",
      labelEn: "Driver Net Payroll",
      amountMyr: input.payrollNetMyr,
      source: input.payrollHasRecords ? "actual" : "estimate",
    },
    {
      key: "fuel",
      label: "车辆油费",
      labelEn: "Vehicle Fuel",
      amountMyr: input.truckFuelMyr,
      source: "estimate",
      detail:
        input.truckEstimateCount > 0
          ? `${input.truckEstimateCount} 辆 MY 车 · 年里程÷12 × 油耗`
          : "未设定车辆年里程",
    },
    {
      key: "maintenance",
      label: "维修/保险摊算",
      labelEn: "Maintenance & Insurance",
      amountMyr: input.truckMaintenanceMyr,
      source: "estimate",
      detail: "RM/km × 月里程（年成本÷12）",
    },
    {
      key: "toll",
      label: "过路费/过境费",
      labelEn: "Toll / Border Fees",
      amountMyr: input.manualCosts.tollFee,
      source: "estimate",
    },
    {
      key: "crateRental",
      label: "租桶费",
      labelEn: "Crate Rental",
      amountMyr: input.manualCosts.crateRental,
      source: "estimate",
    },
    {
      key: "loadUnload",
      label: "Load/Unload费",
      labelEn: "Load / Unload",
      amountMyr: input.manualCosts.loadUnloadFee,
      source: "estimate",
    },
    {
      key: "lkimMaqis",
      label: "LKIM-MAQIS费",
      labelEn: "LKIM-MAQIS",
      amountMyr: input.manualCosts.lkimMaqisFee,
      source: "estimate",
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
    },
    costs: {
      lines: costLines,
      subtotalMyr,
    },
    grossProfitMyr: roundMoney(totalRevenueMyr - subtotalMyr),
    manualCosts: {
      tollFee: input.manualCosts.tollFee,
      crateRental: input.manualCosts.crateRental,
      loadUnloadFee: input.manualCosts.loadUnloadFee,
      lkimMaqisFee: input.manualCosts.lkimMaqisFee,
    },
  };
}

export { DEFAULT_EXCHANGE_RATE, DEFAULT_FUEL_PRICES };
