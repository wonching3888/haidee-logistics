"use server";

import { getCurrentUser } from "@/lib/auth";
import { canExportArInvoice } from "@/lib/auth-roles";
import { assignDocNosForSources } from "@/lib/ar-invoice-export/ar-invoice-docno-registry";
import { fetchCharterAmountsForMonthWithSkips } from "@/lib/ar-invoice-export/ar-invoice-charter-fetcher";
import { buildArCharterExportRows } from "@/lib/ar-invoice-export/ar-invoice-charter-export";
import { buildArCrateReturnExportRows } from "@/lib/ar-invoice-export/ar-invoice-crate-return-export";
import { buildArFreightExportRows } from "@/lib/ar-invoice-export/ar-invoice-freight-export";
import type { ArInvoiceRow } from "@/lib/ar-invoice-export/ar-invoice-row";
import {
  buildArListingPeriodLabel,
  buildSingleSectionListingData,
  formatArListingGeneratedAt,
  resolveFreightListingCompanyKey,
  sumArListingAmounts,
  type ArInvoiceListingCompanyKey,
  type ArInvoiceListingPrintData,
  type ArInvoiceListingSection,
} from "@/lib/ar-invoice-listing-print";
import {
  isMonthlyInvoiceMode,
  type MonthlyInvoiceMode,
} from "@/lib/constants/monthly-invoice";
import { loadCharterReceivableInvoicesForMonth } from "@/lib/receivable-invoices";
import type { UserRole } from "@/types";

async function requireArInvoiceExportAccess() {
  const user = await getCurrentUser();
  if (!user || !canExportArInvoice(user.role as UserRole)) {
    throw new Error("无 AR Invoice 导出权限 AR export access denied");
  }
  return user;
}

function parseYearMonthInput(input: { year: number; month: number }) {
  const year = Number(input.year);
  const month = Number(input.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("无效年份 Invalid year");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("无效月份 Invalid month");
  }
  return { year, month };
}

function parseFreightInput(input: {
  year: number;
  month: number;
  mode: string;
}) {
  const { year, month } = parseYearMonthInput(input);
  if (!isMonthlyInvoiceMode(input.mode)) {
    throw new Error("无效账单模式 Invalid invoice mode");
  }
  return { year, month, mode: input.mode as MonthlyInvoiceMode };
}

function resolveUserIdLabel(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return "—";
  return user.email?.trim() || user.id;
}

function buildPrintMeta(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return {
    generatedAtLabel: formatArListingGeneratedAt(new Date()),
    userIdLabel: resolveUserIdLabel(user),
  };
}

function resolveCurrency(rows: ArInvoiceRow[]): string {
  return rows[0]?.currency ?? "MYR";
}

async function buildCharterListingSections(
  rows: ArInvoiceRow[],
  year: number,
  month: number
): Promise<ArInvoiceListingSection[]> {
  if (rows.length === 0) {
    return buildSingleSectionListingData({ companyKey: "haidee", rows: [] });
  }

  const invoices = await loadCharterReceivableInvoicesForMonth(year, month);
  const { sources } = await fetchCharterAmountsForMonthWithSkips(year, month);
  const docNoByEntity = await assignDocNosForSources(year, month, sources);

  const issuerByEntity = new Map(
    invoices.map((invoice) => [invoice.invoiceKey, invoice.issuerKey])
  );
  const issuerByDocNo = new Map<string, ArInvoiceListingCompanyKey>();
  docNoByEntity.forEach((docNo, entityKey) => {
    issuerByDocNo.set(docNo, issuerByEntity.get(entityKey) ?? "haidee");
  });

  const grouped = new Map<ArInvoiceListingCompanyKey, ArInvoiceRow[]>();
  for (const row of rows) {
    const companyKey = issuerByDocNo.get(row.docNo) ?? "haidee";
    const bucket = grouped.get(companyKey) ?? [];
    bucket.push(row);
    grouped.set(companyKey, bucket);
  }

  const order: ArInvoiceListingCompanyKey[] = ["haidee", "wtl"];
  return order
    .filter((companyKey) => (grouped.get(companyKey)?.length ?? 0) > 0)
    .map((companyKey) => {
      const sectionRows = grouped.get(companyKey)!;
      return {
        companyKey,
        rows: sectionRows,
        totalAmount: sumArListingAmounts(sectionRows),
      };
    });
}

export async function getArFreightListingPrintData(input: {
  year: number;
  month: number;
  mode: string;
}): Promise<ArInvoiceListingPrintData> {
  const user = await requireArInvoiceExportAccess();
  const parsed = parseFreightInput(input);
  const rows = await buildArFreightExportRows(parsed);
  const sections = buildSingleSectionListingData({
    companyKey: resolveFreightListingCompanyKey(parsed.mode),
    rows,
  });

  return {
    kind: "freight",
    year: parsed.year,
    month: parsed.month,
    mode: parsed.mode,
    periodLabel: buildArListingPeriodLabel(parsed.year, parsed.month),
    ...buildPrintMeta(user),
    currency: resolveCurrency(rows),
    totalAmount: sumArListingAmounts(rows),
    sections,
  };
}

export async function getArCrateReturnListingPrintData(input: {
  year: number;
  month: number;
}): Promise<ArInvoiceListingPrintData> {
  const user = await requireArInvoiceExportAccess();
  const parsed = parseYearMonthInput(input);
  const { rows } = await buildArCrateReturnExportRows(parsed);
  const sections = buildSingleSectionListingData({
    companyKey: "haidee",
    rows,
  });

  return {
    kind: "crate_return",
    year: parsed.year,
    month: parsed.month,
    periodLabel: buildArListingPeriodLabel(parsed.year, parsed.month),
    ...buildPrintMeta(user),
    currency: resolveCurrency(rows),
    totalAmount: sumArListingAmounts(rows),
    sections,
  };
}

export async function getArCharterListingPrintData(input: {
  year: number;
  month: number;
}): Promise<ArInvoiceListingPrintData> {
  const user = await requireArInvoiceExportAccess();
  const parsed = parseYearMonthInput(input);
  const { rows } = await buildArCharterExportRows(parsed);
  const sections = await buildCharterListingSections(
    rows,
    parsed.year,
    parsed.month
  );

  return {
    kind: "charter",
    year: parsed.year,
    month: parsed.month,
    periodLabel: buildArListingPeriodLabel(parsed.year, parsed.month),
    ...buildPrintMeta(user),
    currency: resolveCurrency(rows),
    totalAmount: sumArListingAmounts(rows),
    sections,
  };
}
