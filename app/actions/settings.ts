"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isUserRole } from "@/lib/auth-roles";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import {
  DEFAULT_PICKUP_LOCATION,
  isPickupLocation,
} from "@/lib/constants/pickup-locations";
import { MARKET_ORDER, sortMarkets } from "@/lib/markets";
import { createAdminClient } from "@/lib/supabase";
import {
  defaultCostItemsForCountry,
  isTruckCountry,
  loadTruckCostItems,
  prepareTruckCostItemsForSave,
  type TruckCountry,
} from "@/lib/constants/truck-cost";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

export async function getSettingsData() {
  await requireAdmin();

  const [shippers, stalls, defaults, trucks, drivers, users, markets, tongTypes] =
    await Promise.all([
      prisma.shipper.findMany({
        orderBy: { name: "asc" },
        include: { defaultTongType: { select: { id: true, code: true, name: true } } },
      }),
      prisma.stall.findMany({
        orderBy: [{ market: { code: "asc" } }, { code: "asc" }],
        include: {
          market: { select: { id: true, code: true, name: true } },
          consignee: { select: { id: true, code: true, name: true } },
        },
      }),
      prisma.shipperStallDefault.findMany({
        include: {
          shipper: { select: { id: true, name: true, code: true } },
          stall: {
            include: { market: { select: { code: true } } },
          },
        },
        orderBy: [{ shipper: { name: "asc" } }],
      }),
      prisma.truck.findMany({
        orderBy: [{ sortOrder: "asc" }, { plate: "asc" }],
        include: {
          defaultDriver: { select: { id: true, name: true } },
          costItems: { orderBy: { sortOrder: "asc" } },
        },
      }),
      prisma.driver.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.market.findMany({
        where: { active: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
      prisma.tongType.findMany({
        where: { active: true },
        orderBy: { displayOrder: "asc" },
        select: { id: true, code: true, name: true },
      }),
    ]);

  return {
    shippers: shippers.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      nameTh: s.nameTh,
      phone: s.phone,
      defaultTongTypeId: s.defaultTongTypeId,
      defaultTongTypeCode: s.defaultTongType?.code ?? "",
      paymentParty: s.paymentParty,
      company: s.company,
      currency: s.currency,
      pickupLocation: s.pickupLocation,
      active: s.active,
    })),
    stalls: stalls.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      marketId: s.marketId,
      marketCode: s.market?.code ?? "",
      consigneeId: s.consigneeId,
      consigneeCode: s.consignee?.code ?? "",
      consigneeName: s.consignee?.name ?? "",
      active: s.active,
    })),
    defaults: defaults.map((d) => ({
      id: d.id,
      shipperId: d.shipperId,
      shipperName: d.shipper.name,
      stallId: d.stallId,
      stallCode: d.stall.code,
      marketCode: d.stall.market?.code ?? "",
    })),
    trucks: trucks.map((t) => ({
      id: t.id,
      plate: t.plate,
      type: t.type,
      country: isTruckCountry(t.country) ? t.country : "MY",
      capacityTong: t.capacityTong,
      defaultDriverId: t.defaultDriverId,
      defaultDriverName: t.defaultDriver?.name ?? "",
      sortOrder: t.sortOrder,
      fuelEfficiencyKmPerL: t.fuelEfficiencyKmPerL
        ? Number(t.fuelEfficiencyKmPerL)
        : null,
      annualMileageKm: t.annualMileageKm,
      costItems: loadTruckCostItems(
        t.costItems.map((item) => ({
          name: item.name,
          annualAmount: Number(item.annualAmount),
        }))
      ).map((item, index) => ({
        id: `${t.id}-${index}`,
        name: item.name,
        annualAmount: item.annualAmount,
        sortOrder: index,
      })),
      active: t.active,
    })),
    drivers,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      active: u.active,
    })),
    markets: sortMarkets(
      markets.map((market) => market.code),
      MARKET_ORDER
    )
      .concat(
        markets
          .map((market) => market.code)
          .filter((code) => !(MARKET_ORDER as readonly string[]).includes(code))
          .sort()
      )
      .map((code) => {
        const market = markets.find((item) => item.code === code)!;
        return {
          id: market.id,
          code: market.code,
          name: getMarketDisplayName(market.code),
        };
      }),
    tongTypes,
  };
}

// ─── Shippers ────────────────────────────────────────────────────────────────

export async function saveShipper(input: {
  id?: string;
  code: string;
  name: string;
  nameTh?: string;
  phone?: string;
  defaultTongTypeId?: string;
  paymentParty: string;
  company: string;
  currency?: string;
  pickupLocation?: string;
  active: boolean;
}) {
  await requireAdmin();

  const pickupLocation = input.pickupLocation?.trim() || DEFAULT_PICKUP_LOCATION;
  if (!isPickupLocation(pickupLocation)) {
    throw new Error("无效的收货地点 Invalid pickup location");
  }

  const data = {
    code: input.code.trim(),
    name: input.name.trim(),
    nameTh: input.nameTh?.trim() || null,
    phone: input.phone?.trim() || null,
    defaultTongTypeId: input.defaultTongTypeId || null,
    paymentParty: input.paymentParty,
    company: input.company,
    currency: input.currency?.trim() || "THB",
    pickupLocation,
    active: input.active,
  };

  if (input.id) {
    await prisma.shipper.update({ where: { id: input.id }, data });
  } else {
    await prisma.shipper.create({ data });
  }

  revalidatePath("/settings");
  revalidatePath("/inbound");
}

export async function deleteShipper(id: string) {
  await requireAdmin();
  await prisma.shipper.update({ where: { id }, data: { active: false } });
  revalidatePath("/settings");
}

// ─── Stalls ──────────────────────────────────────────────────────────────────

export async function saveStall(input: {
  id?: string;
  code: string;
  name?: string;
  marketId?: string;
  consigneeId?: string | null;
  active: boolean;
}) {
  await requireAdmin();

  const data = {
    code: input.code.trim(),
    name: input.name?.trim() || null,
    marketId: input.marketId || null,
    consigneeId: input.consigneeId || null,
    active: input.active,
  };

  if (input.id) {
    await prisma.stall.update({ where: { id: input.id }, data });
  } else {
    await prisma.stall.create({ data });
  }

  revalidatePath("/settings");
  revalidatePath("/inbound");
}

export async function deleteStall(id: string) {
  await requireAdmin();
  await prisma.stall.update({ where: { id }, data: { active: false } });
  revalidatePath("/settings");
}

// ─── Shipper-Stall Defaults ──────────────────────────────────────────────────

export async function saveShipperStallDefault(input: {
  id?: string;
  shipperId: string;
  stallId: string;
}) {
  await requireAdmin();

  const shipper = await prisma.shipper.findUnique({
    where: { id: input.shipperId },
    select: { defaultTongTypeId: true },
  });
  if (!shipper?.defaultTongTypeId) {
    throw new Error(
      "请先在寄货人主数据中设定默认桶型 Please set default crate type on the consignor first"
    );
  }

  const data = {
    shipperId: input.shipperId,
    stallId: input.stallId,
    tongTypeId: shipper.defaultTongTypeId,
  };

  if (input.id) {
    await prisma.shipperStallDefault.update({
      where: { id: input.id },
      data,
    });
  } else {
    await prisma.shipperStallDefault.create({ data });
  }

  revalidatePath("/settings");
  revalidatePath("/inbound");
}

export async function deleteShipperStallDefault(id: string) {
  await requireAdmin();
  await prisma.shipperStallDefault.delete({ where: { id } });
  revalidatePath("/settings");
}

// ─── Trucks ──────────────────────────────────────────────────────────────────

export async function saveTruck(input: {
  id?: string;
  plate: string;
  type: string;
  country: string;
  capacityTong?: number;
  defaultDriverId?: string | null;
  sortOrder?: number | null;
  fuelEfficiencyKmPerL?: number | null;
  annualMileageKm?: number | null;
  costItems?: { name: string; annualAmount: number }[];
  active: boolean;
}) {
  await requireAdmin();

  if (!isTruckCountry(input.country)) {
    throw new Error("无效的国家 Invalid truck country");
  }

  const country = input.country as TruckCountry;
  const costItems = prepareTruckCostItemsForSave(
    input.costItems && input.costItems.length > 0
      ? input.costItems
      : defaultCostItemsForCountry(country)
  );

  for (const item of costItems) {
    if (!item.name.trim()) {
      throw new Error("成本项目名称不能为空 Cost item name is required");
    }
    if (!Number.isFinite(item.annualAmount) || item.annualAmount < 0) {
      throw new Error("成本项目年度总额无效 Invalid annual amount");
    }
  }

  const data = {
    plate: input.plate.trim().toUpperCase(),
    type: input.type,
    country,
    capacityTong: input.capacityTong ?? null,
    defaultDriverId: input.defaultDriverId || null,
    sortOrder: input.sortOrder ?? null,
    fuelEfficiencyKmPerL:
      input.fuelEfficiencyKmPerL != null ? input.fuelEfficiencyKmPerL : null,
    annualMileageKm: input.annualMileageKm ?? null,
    active: input.active,
  };

  await prisma.$transaction(async (tx) => {
    const truck = input.id
      ? await tx.truck.update({ where: { id: input.id }, data })
      : await tx.truck.create({ data });

    await tx.truckCostItem.deleteMany({ where: { truckId: truck.id } });
    await tx.truckCostItem.createMany({
      data: costItems.map((item, index) => ({
        truckId: truck.id,
        name: item.name.trim(),
        annualAmount: item.annualAmount,
        sortOrder: index,
      })),
    });
  });

  revalidatePath("/settings");
  revalidatePath("/dispatch");
  revalidatePath("/tong/import");
}

export async function deleteTruck(id: string) {
  await requireAdmin();
  await prisma.truck.update({ where: { id }, data: { active: false } });
  revalidatePath("/settings");
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function saveUser(input: {
  id?: string;
  email: string;
  name?: string;
  role: string;
  active: boolean;
  password?: string;
}) {
  await requireAdmin();

  if (!isUserRole(input.role)) {
    throw new Error("无效的角色 Invalid role");
  }

  const supabase = createAdminClient();

  if (input.id) {
    await prisma.user.update({
      where: { id: input.id },
      data: {
        name: input.name?.trim() || null,
        role: input.role,
        active: input.active,
      },
    });

    if (input.password) {
      const { error } = await supabase.auth.admin.updateUserById(input.id, {
        password: input.password,
      });
      if (error) throw new Error(error.message);
    }
  } else {
    if (!input.password) {
      throw new Error("新用户需要密码 Password required for new user");
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: input.email.trim(),
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
    });

    if (error) throw new Error(error.message);

    await prisma.user.create({
      data: {
        id: data.user.id,
        email: input.email.trim(),
        name: input.name?.trim() || null,
        role: input.role,
        active: input.active,
      },
    });
  }

  revalidatePath("/settings");
}

export async function deleteUser(id: string) {
  await requireAdmin();
  await prisma.user.update({ where: { id }, data: { active: false } });
  revalidatePath("/settings");
}
