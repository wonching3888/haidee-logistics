import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { DEFAULT_FUEL_PRICES } from "@/lib/constants/truck-cost";
import { convertThbToMyr } from "@/lib/freight-rates";
import {
  calcFuelCostPerKm,
  calcTotalCostPerKm,
} from "@/lib/truck-cost";

import {
  charterOperationsCostGrandTotal,
  type CharterOperationsCostTotals,
  type CharterOperationsIncomeTotals,
} from "@/lib/charter-operations";
import type { InboundFreightGapReason } from "@/lib/inbound-freight";
import type { OperationsIncomeWarningSample } from "@/lib/operations-income";

export type DataSourceKind = "actual" | "estimate";

export interface MetricLine {
  key: string;
  label: string;
  labelEn: string;
  amountMyr: number;
  amountThb?: number;
  source: DataSourceKind;
  detail?: string;
}

export interface OperationsCostWarning {
  key: string;
  label: string;
  message: string;
}

export interface OperationsRevenueWarning {
  missingRateLineCount: number;
  missingRateQuantity: number;
  gapReasons: Partial<Record<InboundFreightGapReason, number>>;
  samples: OperationsIncomeWarningSample[];
  costWarnings: OperationsCostWarning[];
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
    wtlShipperMyr: number;
    wtlMode3Myr: number;
    partnerFreightMyr: number;
    crateReturnIncomeMyr: number;
    monthlyInvoiceExtraChargesMyr: number;
    charterRevenueMyr: number;
    totalMyr: number;
    lines: MetricLine[];
    warning: OperationsRevenueWarning | null;
  };
  costs: {
    lines: MetricLine[];
    subtotalMyr: number;
    charterTotalMyr: number;
  };
  charter: {
    income: CharterOperationsIncomeTotals;
    costs: CharterOperationsCostTotals;
    costTotalMyr: number;
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
    totalBoxes?: number;
    ratePerBox?: number;
  };
  thaiSegmentFreight: {
    totalAmountMyr: number;
    assignedLineCount: number;
    exchangeRate: number;
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
    mode1aMyr?: number;
    mode1bMyr: number;
    mode2Myr: number;
    wtlMode3Myr: number;
    wtlShipperMyr: number;
    partnerFreightMyr: number;
    crateReturnIncomeMyr: number;
    monthlyInvoiceExtraChargesMyr: number;
    charterRevenueMyr: number;
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
    totalBoxes?: number;
    ratePerBox?: number;
  };
  thaiSegmentFreight: {
    totalAmountMyr: number;
    assignedLineCount: number;
    exchangeRate: number;
  };
  charter: {
    income: CharterOperationsIncomeTotals;
    costs: CharterOperationsCostTotals;
  };
  globalCostRates: {
    epermit: number;
    dagangNet: number;
    forwardingOutbound: number;
    forwardingReturn: number;
    lkimPerCrate: number;
    lkimPerBox: number;
  };
}): OperationsDashboardData {
  const mode1aMyr =
    input.income.mode1aMyr != null
      ? roundMoney(input.income.mode1aMyr)
      : thbToMyr(input.income.mode1aThb, input.exchangeRate);
  const haideeTotalMyr = roundMoney(
    mode1aMyr + input.income.mode1bMyr + input.income.mode2Myr
  );
  const totalRevenueMyr = roundMoney(
    haideeTotalMyr +
      input.income.wtlShipperMyr +
      input.income.wtlMode3Myr +
      input.income.partnerFreightMyr +
      input.income.crateReturnIncomeMyr +
      input.income.monthlyInvoiceExtraChargesMyr +
      input.income.charterRevenueMyr
  );

  const charterCostTotalMyr = charterOperationsCostGrandTotal(input.charter.costs);

  const revenueLines: MetricLine[] = [
    {
      key: "mode1a",
      label: "海利收入 - 寄货人付（THB）",
      labelEn: "HAIDEE Revenue - Shipper Paid (THB)",
      amountMyr: mode1aMyr,
      amountThb: input.income.mode1aThb,
      source: "actual",
      detail: `换算 MYR ÷ ${input.exchangeRate}`,
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
      key: "wtlShipper",
      label: "WTL收入 - 寄货人付（MYR含SST）",
      labelEn: "WTL Revenue - Shipper Paid (MYR incl. SST)",
      amountMyr: input.income.wtlShipperMyr,
      source: "actual",
    },
    {
      key: "mode3",
      label: "WTL收入 - 收货人付（MYR含SST）",
      labelEn: "WTL Revenue - Consignee Paid (MYR incl. SST)",
      amountMyr: input.income.wtlMode3Myr,
      source: "actual",
    },
    {
      key: "partnerFreight",
      label: "合作伙伴车力收入",
      labelEn: "Partner Freight Income",
      amountMyr: input.income.partnerFreightMyr,
      source: "actual",
      detail: "物流合作伙伴回桶车力（ESV-6 0%）",
    },
    {
      key: "crateReturnIncome",
      label: "回收桶月结收入",
      labelEn: "Crate Return Monthly Income",
      amountMyr: input.income.crateReturnIncomeMyr,
      source: "actual",
      detail: "顾客自有桶回收（GLY/GKS）车力费 + 收桶费",
    },
    {
      key: "monthlyInvoiceExtraChargesMyr",
      label: "额外收费 Extra Charges",
      labelEn: "Monthly Invoice Extra Charges",
      amountMyr: input.income.monthlyInvoiceExtraChargesMyr,
      source: "actual",
      detail: "月结账单额外收费（按账单月归月）",
    },
    {
      key: "charterRevenue",
      label: "包车收入",
      labelEn: "Charter Revenue",
      amountMyr: input.income.charterRevenueMyr,
      source: "actual",
      detail:
        input.charter.income.charterTripCount > 0
          ? `${input.charter.income.charterTripCount} 趟 · 基础 ${input.charter.income.charterBaseRevenueMyr.toFixed(2)} + 额外 ${input.charter.income.charterExtraRevenueMyr.toFixed(2)} MYR`
          : "当月无包车记录",
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
      detail: `${(input.lkimMaqis.totalCrates ?? 0).toLocaleString("en-MY")} 桶 × RM ${(input.lkimMaqis.ratePerCrate ?? 0).toFixed(2)} + ${(input.lkimMaqis.totalBoxes ?? 0).toLocaleString("en-MY")} 盒 × RM ${(input.lkimMaqis.ratePerBox ?? 0).toFixed(2)} = RM ${(input.lkimMaqis.totalAmountMyr ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      key: "thaiSegmentFreight",
      label: "泰国段车力",
      labelEn: "Thai Segment Freight",
      amountMyr: input.thaiSegmentFreight.totalAmountMyr,
      source: "estimate",
      detail: `${input.thaiSegmentFreight.assignedLineCount.toLocaleString("en-MY")} 行 · 汇率 ${input.thaiSegmentFreight.exchangeRate.toFixed(4)} · 内部成本分拆`,
    },
    {
      key: "mcThirdParty",
      label: "MC第三方费用",
      labelEn: "MC Third Party",
      amountMyr: input.mcThirdPartyMyr,
      source: "actual",
      detail: "已派车 MC 转第三方 · 按派车日期",
    },
  ];

  const charterCostLines: MetricLine[] =
    input.charter.costs.charterTripCount > 0
      ? [
          {
            key: "charterVehicle",
            label: "包车 — 车辆油费+维修",
            labelEn: "Charter — Vehicle Fuel & Maintenance",
            amountMyr: input.charter.costs.charterVehicleCostMyr,
            source: "estimate",
            detail: `${input.charter.costs.charterTripCount} 趟 · ${input.charter.costs.charterMileageKm.toFixed(0)} km`,
          },
          {
            key: "charterLkim",
            label: "包车 — LKIM",
            labelEn: "Charter — LKIM",
            amountMyr: input.charter.costs.charterLkimMyr,
            source: "actual",
          },
          {
            key: "charterCrateRental",
            label: "包车 — 租桶费",
            labelEn: "Charter — Crate Rental",
            amountMyr: input.charter.costs.charterCrateRentalMyr,
            source: "actual",
          },
          {
            key: "charterUnload",
            label: "包车 — 下货费",
            labelEn: "Charter — Unload Fee",
            amountMyr: input.charter.costs.charterUnloadFeeMyr,
            source: "actual",
          },
          {
            key: "charterLoadingLabor",
            label: "包车 — 上桶费(司机劳务)",
            labelEn: "Charter — Crate Loading Labor",
            amountMyr: input.charter.costs.charterLoadingLaborMyr,
            source: "actual",
            detail: "已确认/已审批报销单 upahNaikTongActual；否则 0",
          },
          {
            key: "charterDriverSalary",
            label: "包车 — 司机薪资",
            labelEn: "Charter — Driver Salary",
            amountMyr: input.charter.costs.charterDriverSalaryMyr,
            source: "actual",
          },
          {
            key: "charterToll",
            label: "包车 — 过路费",
            labelEn: "Charter — Toll",
            amountMyr: input.charter.costs.charterTollMyr,
            source: "actual",
          },
          {
            key: "charterBorder",
            label: "包车 — 边境费",
            labelEn: "Charter — Border Fees",
            amountMyr: input.charter.costs.charterBorderFeesMyr,
            source: "estimate",
            detail: "includeBorderFees=true 的包车记录",
          },
          {
            key: "charterExtraCost",
            label: "包车 — 额外开销",
            labelEn: "Charter — Extra Costs",
            amountMyr: input.charter.costs.charterExtraCostMyr,
            source: "actual",
          },
          {
            key: "charterOtherCost",
            label: "包车 — 其他开销",
            labelEn: "Charter — Other Costs",
            amountMyr: input.charter.costs.charterOtherCostMyr,
            source: "actual",
          },
        ]
      : [];

  const allCostLines = [...costLines, ...charterCostLines];

  const subtotalMyr = roundMoney(
    allCostLines.reduce((sum, line) => sum + line.amountMyr, 0)
  );

  const costWarnings: OperationsCostWarning[] = [];
  const { globalCostRates, tripCosts, lkimMaqis } = input;

  if (globalCostRates.epermit <= 0) {
    costWarnings.push({
      key: "epermit",
      label: "ePermit",
      message: "营运设定未录入 ePermit 费率（global_cost_settings）",
    });
  } else if (tripCosts.tripCount > 0 && tripCosts.epermit <= 0) {
    costWarnings.push({
      key: "epermit",
      label: "ePermit",
      message: `当月 ${tripCosts.tripCount} 趟派车，ePermit 金额为 0`,
    });
  }

  if (globalCostRates.dagangNet <= 0) {
    costWarnings.push({
      key: "dagangNet",
      label: "Dagang Net",
      message: "营运设定未录入 Dagang Net 费率（global_cost_settings）",
    });
  } else if (tripCosts.tripCount > 0 && tripCosts.dagangNet <= 0) {
    costWarnings.push({
      key: "dagangNet",
      label: "Dagang Net",
      message: `当月 ${tripCosts.tripCount} 趟派车，Dagang Net 金额为 0`,
    });
  }

  const forwardingRatesSet =
    globalCostRates.forwardingOutbound > 0 ||
    globalCostRates.forwardingReturn > 0;
  if (!forwardingRatesSet) {
    costWarnings.push({
      key: "forwarding",
      label: "Forwarding",
      message:
        "营运设定未录入 Forwarding 费率（出货 outbound / 回空桶 return）",
    });
  } else if (tripCosts.tripCount > 0 && tripCosts.forwarding <= 0) {
    costWarnings.push({
      key: "forwarding",
      label: "Forwarding",
      message: `当月 ${tripCosts.tripCount} 趟派车，Forwarding 金额为 0`,
    });
  }

  const lkimRatesSet =
    globalCostRates.lkimPerCrate > 0 || globalCostRates.lkimPerBox > 0;
  const hasLkimQty =
    (lkimMaqis.totalCrates ?? 0) > 0 || (lkimMaqis.totalBoxes ?? 0) > 0;
  if (!lkimRatesSet) {
    costWarnings.push({
      key: "lkimMaqis",
      label: "LKIM-MAQIS",
      message: "营运设定未录入 LKIM-MAQIS 费率（桶/盒）",
    });
  } else if (hasLkimQty && lkimMaqis.totalAmountMyr <= 0) {
    costWarnings.push({
      key: "lkimMaqis",
      label: "LKIM-MAQIS",
      message: `当月派车 ${lkimMaqis.totalCrates} 桶 / ${lkimMaqis.totalBoxes ?? 0} 盒，LKIM-MAQIS 金额为 0`,
    });
  }

  const hasFreightWarnings = input.income.missingRateLineCount > 0;
  const hasAnyWarning = hasFreightWarnings || costWarnings.length > 0;

  const revenueWarning: OperationsRevenueWarning | null = hasAnyWarning
    ? {
        missingRateLineCount: input.income.missingRateLineCount,
        missingRateQuantity: input.income.missingRateQuantity,
        gapReasons: input.income.gapReasons,
        samples: input.income.warningSamples,
        costWarnings,
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
      wtlShipperMyr: input.income.wtlShipperMyr,
      wtlMode3Myr: input.income.wtlMode3Myr,
      partnerFreightMyr: input.income.partnerFreightMyr,
      crateReturnIncomeMyr: input.income.crateReturnIncomeMyr,
      monthlyInvoiceExtraChargesMyr: input.income.monthlyInvoiceExtraChargesMyr,
      charterRevenueMyr: input.income.charterRevenueMyr,
      totalMyr: totalRevenueMyr,
      lines: revenueLines,
      warning: revenueWarning,
    },
    costs: {
      lines: allCostLines,
      subtotalMyr,
      charterTotalMyr: charterCostTotalMyr,
    },
    charter: {
      income: input.charter.income,
      costs: input.charter.costs,
      costTotalMyr: charterCostTotalMyr,
    },
    grossProfitMyr: roundMoney(totalRevenueMyr - subtotalMyr),
    tripCosts: input.tripCosts,
    lkimMaqis: input.lkimMaqis,
    thaiSegmentFreight: input.thaiSegmentFreight,
  };
}

export { DEFAULT_EXCHANGE_RATE, DEFAULT_FUEL_PRICES };
