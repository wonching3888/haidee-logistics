import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import type { MonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import type { HaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import type { WtlMonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";
import { isHaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { isWtlMonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";
import type { MonthlyInvoicePrintData } from "@/lib/monthly-invoice-print-data";

export interface MonthlyInvoiceExtraChargeRow {
  id: string;
  description: string;
  amount: number;
  sortOrder: number;
}

export interface MonthlyInvoiceExtraChargeInput {
  description: string;
  amount: number;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function sumExtraChargeAmounts(
  charges: Array<{ amount: number }>
): number {
  return roundMoney(charges.reduce((sum, row) => sum + row.amount, 0));
}

export async function loadMonthlyInvoiceExtraCharges(input: {
  year: number;
  month: number;
  mode: MonthlyInvoiceMode;
  customerId: string;
}): Promise<MonthlyInvoiceExtraChargeRow[]> {
  const rows = await prisma.monthlyInvoiceExtraCharge.findMany({
    where: {
      year: input.year,
      month: input.month,
      mode: input.mode,
      customerId: input.customerId,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    amount: decimalToNumber(row.amount) ?? 0,
    sortOrder: row.sortOrder,
  }));
}

function applyExtraToHaideeData(
  data: HaideeMonthlyInvoiceData,
  extraCharges: MonthlyInvoiceExtraChargeRow[]
): HaideeMonthlyInvoiceData {
  const extraTotal = sumExtraChargeAmounts(extraCharges);
  if (extraTotal <= 0) {
    return { ...data, extraCharges: [] };
  }

  const grandTotalAmount = roundMoney(data.grandTotalAmount + extraTotal);
  return {
    ...data,
    extraCharges,
    grandTotalAmount,
    summary: {
      ...data.summary,
      grandTotalAmount,
    },
  };
}

function applyExtraToWtlData(
  data: WtlMonthlyInvoiceData,
  extraCharges: MonthlyInvoiceExtraChargeRow[]
): WtlMonthlyInvoiceData {
  const extraTotal = sumExtraChargeAmounts(extraCharges);
  if (extraTotal <= 0) {
    return { ...data, extraCharges: [] };
  }

  const { totals, taxSummary } = data.taxInvoice;
  const adjustedTotals = {
    subTotalExcludingTax: roundMoney(totals.subTotalExcludingTax + extraTotal),
    sstBase: totals.sstBase,
    sstAmount: totals.sstAmount,
    totalInclusive: roundMoney(totals.totalInclusive + extraTotal),
  };

  return {
    ...data,
    extraCharges,
    grandTotalAmount: roundMoney(data.grandTotalAmount + extraTotal),
    taxInvoice: {
      ...data.taxInvoice,
      totals: adjustedTotals,
      taxSummary: {
        sstBase: taxSummary.sstBase,
        sstAmount: taxSummary.sstAmount,
      },
    },
  };
}

export async function applyMonthlyInvoiceExtraChargesToPrintData(
  data: MonthlyInvoicePrintData,
  input: {
    year: number;
    month: number;
    mode: MonthlyInvoiceMode;
    customerId: string;
  }
): Promise<MonthlyInvoicePrintData> {
  const extraCharges = await loadMonthlyInvoiceExtraCharges(input);
  if (extraCharges.length === 0) {
    if (isHaideeMonthlyInvoiceData(data)) {
      return { ...data, extraCharges: [] };
    }
    if (isWtlMonthlyInvoiceData(data)) {
      return { ...data, extraCharges: [] };
    }
    return data;
  }

  if (isHaideeMonthlyInvoiceData(data)) {
    return applyExtraToHaideeData(data, extraCharges);
  }
  if (isWtlMonthlyInvoiceData(data)) {
    return applyExtraToWtlData(data, extraCharges);
  }

  return data;
}

export function validateMonthlyInvoiceExtraChargeInputs(
  items: MonthlyInvoiceExtraChargeInput[]
): MonthlyInvoiceExtraChargeInput[] {
  const normalized: MonthlyInvoiceExtraChargeInput[] = [];

  for (const item of items) {
    const description = item.description.trim();
    if (!description) {
      throw new Error("额外收费说明不能为空 Extra charge description is required");
    }
    if (!Number.isFinite(item.amount) || item.amount <= 0) {
      throw new Error("额外收费金额必须大于 0 Extra charge amount must be greater than 0");
    }
    normalized.push({
      description,
      amount: roundMoney(item.amount),
    });
  }

  return normalized;
}
