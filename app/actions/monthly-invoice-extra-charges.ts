"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canViewFreightInfo } from "@/lib/auth-roles";
import type { UserRole } from "@/types";
import {
  isMonthlyInvoiceMode,
  type MonthlyInvoiceMode,
} from "@/lib/constants/monthly-invoice";
import {
  loadMonthlyInvoiceExtraCharges,
  validateMonthlyInvoiceExtraChargeInputs,
  type MonthlyInvoiceExtraChargeInput,
  type MonthlyInvoiceExtraChargeRow,
} from "@/lib/monthly-invoice-extra-charges";

async function requireFreightViewer() {
  const user = await getCurrentUser();
  if (!user || !canViewFreightInfo(user.role as UserRole)) {
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

export async function getMonthlyInvoiceExtraCharges(input: {
  year: number;
  month: number;
  mode: string;
  customerId: string;
}): Promise<MonthlyInvoiceExtraChargeRow[]> {
  await requireFreightViewer();
  parseYearMonth(input.year, input.month);
  if (!isMonthlyInvoiceMode(input.mode)) {
    throw new Error("无效账单模式 Invalid invoice mode");
  }
  if (!input.customerId?.trim()) {
    throw new Error("缺少顾客 ID Missing customer ID");
  }

  return loadMonthlyInvoiceExtraCharges({
    year: input.year,
    month: input.month,
    mode: input.mode as MonthlyInvoiceMode,
    customerId: input.customerId,
  });
}

export async function saveMonthlyInvoiceExtraCharges(input: {
  year: number;
  month: number;
  mode: string;
  customerId: string;
  items: MonthlyInvoiceExtraChargeInput[];
}): Promise<MonthlyInvoiceExtraChargeRow[]> {
  await requireFreightViewer();
  parseYearMonth(input.year, input.month);
  if (!isMonthlyInvoiceMode(input.mode)) {
    throw new Error("无效账单模式 Invalid invoice mode");
  }
  if (!input.customerId?.trim()) {
    throw new Error("缺少顾客 ID Missing customer ID");
  }

  const items = validateMonthlyInvoiceExtraChargeInputs(input.items);
  const mode = input.mode as MonthlyInvoiceMode;

  await prisma.$transaction(async (tx) => {
    await tx.monthlyInvoiceExtraCharge.deleteMany({
      where: {
        year: input.year,
        month: input.month,
        mode,
        customerId: input.customerId,
      },
    });

    if (items.length > 0) {
      await tx.monthlyInvoiceExtraCharge.createMany({
        data: items.map((item, index) => ({
          year: input.year,
          month: input.month,
          mode,
          customerId: input.customerId,
          description: item.description,
          amount: item.amount,
          sortOrder: index,
        })),
      });
    }
  });

  return loadMonthlyInvoiceExtraCharges({
    year: input.year,
    month: input.month,
    mode,
    customerId: input.customerId,
  });
}
