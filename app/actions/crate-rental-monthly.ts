"use server";

import { getCurrentUser } from "@/lib/auth";
import { canViewOperationsDashboard } from "@/lib/auth-roles";
import {
  buildCrateRentalMonthlyReport,
  type CrateRentalMonthlyReport,
} from "@/lib/crate-rental-monthly-report";
import type { UserRole } from "@/types";

export type { CrateRentalMonthlyReport };

async function requireReportAccess() {
  const user = await getCurrentUser();
  if (!user || !canViewOperationsDashboard(user.role as UserRole)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

export async function getCrateRentalMonthlyReport(input: {
  year: number;
  month: number;
}): Promise<CrateRentalMonthlyReport> {
  await requireReportAccess();
  if (input.month < 1 || input.month > 12) {
    throw new Error("Invalid month");
  }
  return buildCrateRentalMonthlyReport(input.year, input.month);
}
