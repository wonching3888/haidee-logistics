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
import { buildMode4MonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";
import { buildMode3MonthlyInvoiceData } from "@/lib/monthly-invoice-mode3";
import { buildHaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { isHaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import { applyMonthlyInvoiceExtraChargesToPrintData } from "@/lib/monthly-invoice-extra-charges";
import { HAIDEE_MODE1A_INVOICE_DETAILS } from "@/lib/constants/haidee-company-details";
import { formatDisplayDate } from "@/lib/date-utils";
import { resolveFreightInvoiceDocNo } from "@/lib/monthly-invoice-docno";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

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

  return {
    year: input.year,
    month: input.month,
    periodLabel: formatInvoicePeriodLabel(input.year, input.month),
    mode: config,
    customers,
  };
}

export async function getMonthlyInvoicePrintData(input: {
  year: number;
  month: number;
  mode: string;
  customerId: string;
}) {
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
    return applyMonthlyInvoiceExtraChargesToPrintData(data, {
      year: input.year,
      month: input.month,
      mode: input.mode,
      customerId: input.customerId,
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
    return applyMonthlyInvoiceExtraChargesToPrintData(data, {
      year: input.year,
      month: input.month,
      mode: input.mode,
      customerId: input.customerId,
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
    if (input.mode !== "1a") return withExtras;

    const { end } = getMonthDateRange(input.year, input.month);
    const invoiceNo = await resolveFreightInvoiceDocNo({
      mode: "1a",
      billToRole: withExtras.billToRole,
      customerId: input.customerId,
      year: input.year,
      month: input.month,
    });

    return {
      ...withExtras,
      mode1aPrint: {
        invoiceNo: invoiceNo ?? "—",
        invoiceDateLabel: formatDisplayDate(end),
        termsLabel: HAIDEE_MODE1A_INVOICE_DETAILS.terms,
      },
    };
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
