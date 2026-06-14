"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { decimalToNumber } from "@/lib/freight-rates";
import { sortMarkets } from "@/lib/markets";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

function parseOptionalDecimal(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("数值不能为负数 Value cannot be negative");
  }
  return value;
}

function serializeRouteMaster(route: {
  id: string;
  code: string;
  name: string;
  markets: string[];
  sadooMileageKm: unknown;
  tollFee: unknown;
  borderPassFee: unknown;
  fishCheckingFee: unknown;
  kpbFee: unknown;
  parkingFee: unknown;
  epermitCharge: unknown;
  forwardingOutbound: unknown;
  forwardingReturn: unknown;
  dagangNetFee: unknown;
  displayOrder: number | null;
  active: boolean;
}) {
  return {
    id: route.id,
    code: route.code,
    name: route.name,
    markets: sortMarkets(route.markets),
    sadooMileageKm: decimalToNumber(route.sadooMileageKm),
    tollFee: decimalToNumber(route.tollFee),
    borderPassFee: decimalToNumber(route.borderPassFee),
    fishCheckingFee: decimalToNumber(route.fishCheckingFee),
    kpbFee: decimalToNumber(route.kpbFee),
    parkingFee: decimalToNumber(route.parkingFee),
    epermitCharge: decimalToNumber(route.epermitCharge),
    forwardingOutbound: decimalToNumber(route.forwardingOutbound),
    forwardingReturn: decimalToNumber(route.forwardingReturn),
    dagangNetFee: decimalToNumber(route.dagangNetFee),
    displayOrder: route.displayOrder,
    active: route.active,
  };
}

export async function getRouteMasterSettingsData() {
  await requireAdmin();

  const routes = await prisma.routeMaster.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return routes.map(serializeRouteMaster);
}

export async function saveRouteMaster(input: {
  id?: string;
  code: string;
  name: string;
  markets: string[];
  sadooMileageKm?: number | null;
  tollFee?: number | null;
  borderPassFee?: number | null;
  fishCheckingFee?: number | null;
  kpbFee?: number | null;
  parkingFee?: number | null;
  epermitCharge?: number | null;
  forwardingOutbound?: number | null;
  forwardingReturn?: number | null;
  dagangNetFee?: number | null;
  displayOrder?: number | null;
  active?: boolean;
}) {
  await requireAdmin();

  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!code) throw new Error("路线代码不能为空 Route code is required");
  if (!name) throw new Error("路线名称不能为空 Route name is required");

  const markets = sortMarkets(
    Array.from(
      new Set(
        input.markets.map((code) => code.trim().toUpperCase()).filter(Boolean)
      )
    )
  );
  if (markets.length === 0) {
    throw new Error("请至少选择一个市场 Select at least one market");
  }

  const data = {
    code,
    name,
    markets,
    sadooMileageKm: parseOptionalDecimal(input.sadooMileageKm),
    tollFee: parseOptionalDecimal(input.tollFee),
    borderPassFee: parseOptionalDecimal(input.borderPassFee),
    fishCheckingFee: parseOptionalDecimal(input.fishCheckingFee),
    kpbFee: parseOptionalDecimal(input.kpbFee),
    parkingFee: parseOptionalDecimal(input.parkingFee),
    epermitCharge: parseOptionalDecimal(input.epermitCharge),
    forwardingOutbound: parseOptionalDecimal(input.forwardingOutbound),
    forwardingReturn: parseOptionalDecimal(input.forwardingReturn),
    dagangNetFee: parseOptionalDecimal(input.dagangNetFee),
    displayOrder: input.displayOrder ?? null,
    active: input.active ?? true,
  };

  if (input.id) {
    await prisma.routeMaster.update({
      where: { id: input.id },
      data,
    });
  } else {
    const existing = await prisma.routeMaster.findUnique({ where: { code } });
    if (existing) {
      throw new Error(`路线代码 ${code} 已存在 Route code already exists`);
    }
    await prisma.routeMaster.create({ data });
  }

  revalidatePath("/settings");
  revalidatePath("/operations");
}

export async function deleteRouteMaster(id: string) {
  await requireAdmin();
  await prisma.routeMaster.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/operations");
}
