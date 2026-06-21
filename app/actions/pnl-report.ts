"use server";

import { getCurrentUser } from "@/lib/auth";
import { canViewPnlOperations } from "@/lib/auth-roles";
import {
  buildPnlReport,
} from "@/lib/pnl-report";
import type {
  PnlCustomerSort,
  PnlPeriodMode,
  PnlReportData,
  PnlRouteFilter,
} from "@/lib/pnl-report-types";
import type { UserRole } from "@/types";

async function requireOperationsAccess() {
  const user = await getCurrentUser();
  if (!user || !canViewPnlOperations(user.role as UserRole)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

export async function getPnlReport(input: {
  year: number;
  month: number;
  periodMode?: PnlPeriodMode;
  day?: string;
  rangeStart?: string;
  rangeEnd?: string;
  routeFilter?: PnlRouteFilter;
  driverFilter?: string;
  customerSort?: PnlCustomerSort;
}): Promise<PnlReportData> {
  await requireOperationsAccess();
  return buildPnlReport(input);
}
