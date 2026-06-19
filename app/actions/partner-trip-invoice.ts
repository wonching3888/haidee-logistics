"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canViewFreightInfo } from "@/lib/auth-roles";
import type { UserRole } from "@/types";
import {
  ensurePartnerTripInvoice,
  listPartnerTripsForMonth,
  type PartnerTripInvoicePrintData,
  type PartnerTripSummary,
} from "@/lib/partner-freight";

async function requireFreightViewer() {
  const user = await getCurrentUser();
  if (!user || !canViewFreightInfo(user.role as UserRole)) {
    throw new Error("无权限查看合作伙伴车力单 Unauthorized");
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

export async function getPartnerTripInvoiceTrips(input: {
  year: number;
  month: number;
}): Promise<{
  year: number;
  month: number;
  trips: PartnerTripSummary[];
  totalAmountMyr: number;
  tripCount: number;
}> {
  await requireFreightViewer();
  parseYearMonth(input.year, input.month);

  const trips = await listPartnerTripsForMonth(input.year, input.month);
  const totalAmountMyr = Math.round(
    trips.reduce((sum, trip) => sum + trip.amountMyr, 0) * 100
  ) / 100;

  return {
    year: input.year,
    month: input.month,
    trips,
    totalAmountMyr,
    tripCount: trips.length,
  };
}

export async function getPartnerTripInvoicePrintData(input: {
  tripDate: string;
  truckId: string;
  marketId: string;
  crateType: string;
}): Promise<PartnerTripInvoicePrintData> {
  await requireFreightViewer();

  if (!input.tripDate?.trim()) {
    throw new Error("缺少日期 Missing trip date");
  }
  if (!input.truckId?.trim() || !input.marketId?.trim()) {
    throw new Error("缺少趟次信息 Missing trip identifiers");
  }
  if (!input.crateType?.trim()) {
    throw new Error("缺少桶型 Missing crate type");
  }

  return ensurePartnerTripInvoice({
    tripDateInput: input.tripDate.trim(),
    truckId: input.truckId.trim(),
    marketId: input.marketId.trim(),
    crateType: input.crateType.trim(),
  });
}

export async function listPartnerFreightRateConfigs() {
  await requireFreightViewer();
  return prisma.partnerFreightRate.findMany({
    where: { active: true },
    include: {
      billToShipper: { select: { code: true, name: true } },
    },
    orderBy: { crateType: "asc" },
  });
}
