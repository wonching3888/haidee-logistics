"use server";

import { getCurrentUser } from "@/lib/auth";
import { canExportArInvoice } from "@/lib/auth-roles";
import type { MonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import { isMonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import {
  buildArFreightExportCsv,
  buildArFreightExportPreview,
} from "@/lib/ar-invoice-export/ar-invoice-freight-export";
import {
  buildArCharterExportCsv,
  buildArCharterExportPreview,
} from "@/lib/ar-invoice-export/ar-invoice-charter-export";
import {
  buildArCrateReturnExportCsv,
  buildArCrateReturnExportPreview,
} from "@/lib/ar-invoice-export/ar-invoice-crate-return-export";
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

function parseExportInput(input: {
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

export async function getArFreightExportPreview(input: {
  year: number;
  month: number;
  mode: string;
}) {
  await requireArInvoiceExportAccess();
  const parsed = parseExportInput(input);
  return buildArFreightExportPreview(parsed);
}

export async function exportArFreightCsvAction(input: {
  year: number;
  month: number;
  mode: string;
}) {
  await requireArInvoiceExportAccess();
  const parsed = parseExportInput(input);
  const result = await buildArFreightExportCsv(parsed);
  return {
    filename: result.filename,
    content: result.content,
    preview: result.preview,
  };
}

export async function getArCrateReturnExportPreview(input: {
  year: number;
  month: number;
}) {
  await requireArInvoiceExportAccess();
  const parsed = parseYearMonthInput(input);
  return buildArCrateReturnExportPreview(parsed);
}

export async function exportArCrateReturnCsvAction(input: {
  year: number;
  month: number;
}) {
  await requireArInvoiceExportAccess();
  const parsed = parseYearMonthInput(input);
  const result = await buildArCrateReturnExportCsv(parsed);
  return {
    filename: result.filename,
    content: result.content,
    preview: result.preview,
  };
}

export async function getArCharterExportPreview(input: {
  year: number;
  month: number;
}) {
  await requireArInvoiceExportAccess();
  const parsed = parseYearMonthInput(input);
  return buildArCharterExportPreview(parsed);
}

export async function exportArCharterCsvAction(input: {
  year: number;
  month: number;
}) {
  await requireArInvoiceExportAccess();
  const parsed = parseYearMonthInput(input);
  const result = await buildArCharterExportCsv(parsed);
  return {
    filename: result.filename,
    content: result.content,
    preview: result.preview,
  };
}
