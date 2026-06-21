"use server";

import { getCurrentUser } from "@/lib/auth";
import { canViewInvoiceAmounts } from "@/lib/auth-roles";
import type { UserRole } from "@/types";
import {
  getCrateReturnMonthlyInvoicePrintData,
  listCrateReturnMonthlyInvoicesForMonth,
  loadActiveCrateReturnFreightRates,
  type CrateReturnMonthlyInvoicePrintData,
  type CrateReturnMonthlyInvoiceSummary,
} from "@/lib/crate-return-billing";

async function requireFreightViewer() {
  const user = await getCurrentUser();
  if (!user || !canViewInvoiceAmounts(user.role as UserRole)) {
    throw new Error("无权限查看回收桶月结单 Unauthorized");
  }
  return user;
}

function parseYearMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("无效年份 Invalid year");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("无效月份 Invalid month");
  }
}

export async function getCrateReturnMonthlyInvoices(input: {
  year: number;
  month: number;
}): Promise<{
  year: number;
  month: number;
  invoices: CrateReturnMonthlyInvoiceSummary[];
  totalAmountMyr: number;
}> {
  await requireFreightViewer();
  parseYearMonth(input.year, input.month);

  const invoices = await listCrateReturnMonthlyInvoicesForMonth(
    input.year,
    input.month
  );
  const totalAmountMyr = Math.round(
    invoices.reduce((sum, row) => sum + row.totalAmountMyr, 0) * 100
  ) / 100;

  return {
    year: input.year,
    month: input.month,
    invoices,
    totalAmountMyr,
  };
}

export async function fetchCrateReturnMonthlyInvoicePrintData(input: {
  year: number;
  month: number;
  crateType: string;
}): Promise<CrateReturnMonthlyInvoicePrintData> {
  await requireFreightViewer();
  parseYearMonth(input.year, input.month);

  if (!input.crateType?.trim()) {
    throw new Error("缺少桶型 Missing crate type");
  }

  return getCrateReturnMonthlyInvoicePrintData({
    year: input.year,
    month: input.month,
    crateType: input.crateType.trim(),
  });
}

export async function listCrateReturnFreightRateConfigs() {
  await requireFreightViewer();
  return loadActiveCrateReturnFreightRates();
}
