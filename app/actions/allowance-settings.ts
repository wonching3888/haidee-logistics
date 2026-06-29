"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  DEFAULT_BP_CRATE_COMMISSION_BIG_TRUCK,
  DEFAULT_BP_CRATE_COMMISSION_SMALL_TRUCK,
  DEFAULT_CRATE_RETURN_MULTI_MARKET_ALLOWANCE,
  DEFAULT_EXTRA_MARKET_ALLOWANCE,
} from "@/lib/constants/payroll-allowance";
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

function parseOptionalRate(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("金额不能为负数 Amount cannot be negative");
  }
  return value;
}

async function ensurePayrollAllowanceSettings() {
  return prisma.payrollAllowanceSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      extraMarketAllowance: DEFAULT_EXTRA_MARKET_ALLOWANCE,
      bpCrateCommissionBigTruck: DEFAULT_BP_CRATE_COMMISSION_BIG_TRUCK,
      bpCrateCommissionSmallTruck: DEFAULT_BP_CRATE_COMMISSION_SMALL_TRUCK,
      crateReturnMultiMarketAllowance: DEFAULT_CRATE_RETURN_MULTI_MARKET_ALLOWANCE,
    },
    update: {},
  });
}

export async function getAllowanceSettingsData() {
  await requireAdmin();

  const [routes, settings] = await Promise.all([
    prisma.routeMaster.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    }),
    ensurePayrollAllowanceSettings(),
  ]);

  return {
    routes: routes.map((route) => ({
      id: route.id,
      code: route.code,
      name: route.name,
      markets: route.markets,
      driverAllowance: decimalToNumber(route.driverAllowance),
    })),
    extraMarketAllowance:
      decimalToNumber(settings.extraMarketAllowance) ??
      DEFAULT_EXTRA_MARKET_ALLOWANCE,
    bigTruckCrateCommission: decimalToNumber(settings.bigTruckCrateCommission),
    smallTruckCrateCommission: decimalToNumber(
      settings.smallTruckCrateCommission
    ),
    bpCrateCommissionBigTruck: decimalToNumber(
      settings.bpCrateCommissionBigTruck
    ),
    bpCrateCommissionSmallTruck: decimalToNumber(
      settings.bpCrateCommissionSmallTruck
    ),
    crateReturnMultiMarketAllowance:
      decimalToNumber(settings.crateReturnMultiMarketAllowance) ??
      DEFAULT_CRATE_RETURN_MULTI_MARKET_ALLOWANCE,
  };
}

export async function saveAllowanceSettings(input: {
  routeAllowances: { routeId: string; driverAllowance?: number | null }[];
  extraMarketAllowance?: number | null;
  bigTruckCrateCommission?: number | null;
  smallTruckCrateCommission?: number | null;
  bpCrateCommissionBigTruck?: number | null;
  bpCrateCommissionSmallTruck?: number | null;
  crateReturnMultiMarketAllowance?: number | null;
}) {
  await requireAdmin();

  await prisma.$transaction([
    ...input.routeAllowances.map((item) =>
      prisma.routeMaster.update({
        where: { id: item.routeId },
        data: {
          driverAllowance: parseOptionalRate(item.driverAllowance),
        },
      })
    ),
    prisma.payrollAllowanceSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        extraMarketAllowance:
          parseOptionalRate(input.extraMarketAllowance) ??
          DEFAULT_EXTRA_MARKET_ALLOWANCE,
        bigTruckCrateCommission: parseOptionalRate(
          input.bigTruckCrateCommission
        ),
        smallTruckCrateCommission: parseOptionalRate(
          input.smallTruckCrateCommission
        ),
        bpCrateCommissionBigTruck: parseOptionalRate(
          input.bpCrateCommissionBigTruck
        ),
        bpCrateCommissionSmallTruck: parseOptionalRate(
          input.bpCrateCommissionSmallTruck
        ),
        crateReturnMultiMarketAllowance:
          parseOptionalRate(input.crateReturnMultiMarketAllowance) ??
          DEFAULT_CRATE_RETURN_MULTI_MARKET_ALLOWANCE,
      },
      update: {
        extraMarketAllowance: parseOptionalRate(input.extraMarketAllowance),
        bigTruckCrateCommission: parseOptionalRate(
          input.bigTruckCrateCommission
        ),
        smallTruckCrateCommission: parseOptionalRate(
          input.smallTruckCrateCommission
        ),
        bpCrateCommissionBigTruck: parseOptionalRate(
          input.bpCrateCommissionBigTruck
        ),
        bpCrateCommissionSmallTruck: parseOptionalRate(
          input.bpCrateCommissionSmallTruck
        ),
        crateReturnMultiMarketAllowance: parseOptionalRate(
          input.crateReturnMultiMarketAllowance
        ),
      },
    }),
  ]);

  revalidatePath("/settings");
  revalidatePath("/driver-payroll");
}

export async function loadPayrollAllowanceContext() {
  const [routes, settings] = await Promise.all([
    prisma.routeMaster.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    }),
    ensurePayrollAllowanceSettings(),
  ]);

  return {
    routes: routes.map((route) => ({
      code: route.code,
      markets: route.markets,
      driverAllowance: decimalToNumber(route.driverAllowance),
      displayOrder: route.displayOrder,
    })),
    extraMarketAllowance:
      decimalToNumber(settings.extraMarketAllowance) ??
      DEFAULT_EXTRA_MARKET_ALLOWANCE,
    bigTruckCrateCommission: decimalToNumber(settings.bigTruckCrateCommission),
    smallTruckCrateCommission: decimalToNumber(
      settings.smallTruckCrateCommission
    ),
    bpCrateCommissionBigTruck: decimalToNumber(
      settings.bpCrateCommissionBigTruck
    ),
    bpCrateCommissionSmallTruck: decimalToNumber(
      settings.bpCrateCommissionSmallTruck
    ),
    crateReturnMultiMarketAllowance:
      decimalToNumber(settings.crateReturnMultiMarketAllowance) ??
      DEFAULT_CRATE_RETURN_MULTI_MARKET_ALLOWANCE,
  };
}
