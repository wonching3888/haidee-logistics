"use server";

import { getCurrentUser } from "@/lib/auth";
import { canViewInvoiceAmounts } from "@/lib/auth-roles";
import type { UserRole } from "@/types";
import {
  formatInvoicePeriodLabel,
  getMonthlyInvoiceModeConfig,
  isMonthlyInvoiceMode,
} from "@/lib/constants/monthly-invoice";
import {
  buildMonthlyInvoiceCustomerSummaries,
  buildMonthlyInvoiceData,
} from "@/lib/monthly-invoice";
import { fetchRawInvoiceLines } from "@/lib/monthly-invoice-lines";
import { buildHaideeMonthlyInvoiceData, isHaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { buildMode4MonthlyInvoiceData, isWtlMonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";
import { buildMode3MonthlyInvoiceData } from "@/lib/monthly-invoice-mode3";
import {
  applyMonthlyInvoiceExtraChargesToPrintData,
  loadMonthlyInvoiceExtraChargeTotalsByCustomer,
} from "@/lib/monthly-invoice-extra-charges";
import { attachAccountingPrint } from "@/lib/monthly-invoice-accounting-print";
import { resolveShipperInvoiceCompanyForPrint } from "@/lib/monthly-invoice-shipper-invoice-company";
import type { MonthlyInvoicePrintData } from "@/lib/monthly-invoice-print-data";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function requireFreightViewer() {
  const user = await getCurrentUser();
  if (!user || !canViewInvoiceAmounts(user.role as UserRole)) {
    throw new Error("无权限查看车力账单 Unauthorized");
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

export async function getMonthlyInvoiceCustomers(input: {
  year: number;
  month: number;
  mode: string;
}) {
  await requireFreightViewer();
  parseYearMonth(input.year, input.month);
  if (!isMonthlyInvoiceMode(input.mode)) {
    throw new Error("无效账单模式 Invalid invoice mode");
  }

  const config = getMonthlyInvoiceModeConfig(input.mode)!;
  const rawLines = await fetchRawInvoiceLines(input.year, input.month, input.mode);
  const customers = buildMonthlyInvoiceCustomerSummaries(rawLines, config);
  const extraChargeTotals = await loadMonthlyInvoiceExtraChargeTotalsByCustomer({
    year: input.year,
    month: input.month,
    mode: input.mode,
  });
  const customersWithExtras = customers.map((customer) => {
    const extra = extraChargeTotals.get(customer.customerId) ?? 0;
    if (extra <= 0) return customer;
    return { ...customer, grandTotal: roundMoney(customer.grandTotal + extra) };
  });

  return {
    year: input.year,
    month: input.month,
    periodLabel: formatInvoicePeriodLabel(input.year, input.month),
    mode: config,
    customers: customersWithExtras,
  };
}

export async function getMonthlyInvoicePrintData(input: {
  year: number;
  month: number;
  mode: string;
  customerId: string;
}): Promise<MonthlyInvoicePrintData | null> {
  await requireFreightViewer();
  parseYearMonth(input.year, input.month);
  if (!isMonthlyInvoiceMode(input.mode)) {
    throw new Error("无效账单模式 Invalid invoice mode");
  }
  if (!input.customerId?.trim()) {
    throw new Error("缺少顾客 ID Missing customer ID");
  }

  const config = getMonthlyInvoiceModeConfig(input.mode)!;
  const rawLines = await fetchRawInvoiceLines(input.year, input.month, input.mode);

  if (input.mode === "4") {
    const data = buildMode4MonthlyInvoiceData({
      mode: config,
      year: input.year,
      month: input.month,
      periodLabel: formatInvoicePeriodLabel(input.year, input.month),
      customerId: input.customerId,
      rawLines,
    });
    if (!data) return null;
    const withExtras = await applyMonthlyInvoiceExtraChargesToPrintData(data, {
      year: input.year,
      month: input.month,
      mode: input.mode,
      customerId: input.customerId,
    });
    if (!withExtras) return null;
    if (!isWtlMonthlyInvoiceData(withExtras)) return withExtras;
    return attachAccountingPrint(withExtras, {
      mode: input.mode,
      customerId: input.customerId,
      year: input.year,
      month: input.month,
    });
  }

  if (input.mode === "3") {
    const data = buildMode3MonthlyInvoiceData({
      mode: config,
      year: input.year,
      month: input.month,
      periodLabel: formatInvoicePeriodLabel(input.year, input.month),
      customerId: input.customerId,
      rawLines,
    });
    if (!data) return null;
    const withExtras = await applyMonthlyInvoiceExtraChargesToPrintData(data, {
      year: input.year,
      month: input.month,
      mode: input.mode,
      customerId: input.customerId,
    });
    if (!withExtras) return null;
    if (!isWtlMonthlyInvoiceData(withExtras)) return withExtras;
    return attachAccountingPrint(withExtras, {
      mode: input.mode,
      customerId: input.customerId,
      year: input.year,
      month: input.month,
    });
  }

  if (input.mode === "1a" || input.mode === "1b" || input.mode === "2") {
    const data = buildHaideeMonthlyInvoiceData({
      mode: config,
      year: input.year,
      month: input.month,
      periodLabel: formatInvoicePeriodLabel(input.year, input.month),
      customerId: input.customerId,
      rawLines,
    });
    if (!data) return null;
    const withExtras = await applyMonthlyInvoiceExtraChargesToPrintData(data, {
      year: input.year,
      month: input.month,
      mode: input.mode,
      customerId: input.customerId,
    });
    if (!withExtras || !isHaideeMonthlyInvoiceData(withExtras)) {
      return withExtras;
    }

    const invoiceCompany =
      input.mode === "1a"
        ? await resolveShipperInvoiceCompanyForPrint({
            mode: input.mode,
            billToRole: withExtras.billToRole,
            customerId: input.customerId,
          })
        : undefined;

    const withIssuer =
      input.mode === "1a"
        ? { ...withExtras, invoiceCompany }
        : withExtras;

    return attachAccountingPrint(withIssuer, {
      mode: input.mode,
      customerId: input.customerId,
      year: input.year,
      month: input.month,
    });
  }

  const data = buildMonthlyInvoiceData({
    mode: config,
    year: input.year,
    month: input.month,
    periodLabel: formatInvoicePeriodLabel(input.year, input.month),
    customerId: input.customerId,
    rawLines,
  });
  return data;
}
