"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getMarketDisplayName } from "@/lib/constants/market-names";

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
        include: { market: { select: { id: true, code: true, name: true } } },
      }),
      prisma.shipperStallDefault.findMany({
        include: {
          shipper: { select: { id: true, name: true, code: true } },
          stall: {
            include: { market: { select: { code: true } } },
          },
          tongType: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ shipper: { name: "asc" } }],
      }),
      prisma.truck.findMany({
        orderBy: [{ sortOrder: "asc" }, { plate: "asc" }],
        include: { defaultDriver: { select: { id: true, name: true } } },
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
      active: s.active,
    })),
    stalls: stalls.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      marketId: s.marketId,
      marketCode: s.market?.code ?? "",
      active: s.active,
    })),
    defaults: defaults.map((d) => ({
      id: d.id,
      shipperId: d.shipperId,
      shipperName: d.shipper.name,
      stallId: d.stallId,
      stallCode: d.stall.code,
      marketCode: d.stall.market?.code ?? "",
      tongTypeId: d.tongTypeId,
      tongTypeCode: d.tongType.code,
    })),
    trucks: trucks.map((t) => ({
      id: t.id,
      plate: t.plate,
      type: t.type,
      capacityTong: t.capacityTong,
      defaultDriverId: t.defaultDriverId,
      defaultDriverName: t.defaultDriver?.name ?? "",
      sortOrder: t.sortOrder,
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
    markets: markets.map((m) => ({
      id: m.id,
      code: m.code,
      name: getMarketDisplayName(m.code),
    })),
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
  active: boolean;
}) {
  await requireAdmin();

  const data = {
    code: input.code.trim(),
    name: input.name.trim(),
    nameTh: input.nameTh?.trim() || null,
    phone: input.phone?.trim() || null,
    defaultTongTypeId: input.defaultTongTypeId || null,
    paymentParty: input.paymentParty,
    company: input.company,
    currency: input.currency?.trim() || "THB",
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
  active: boolean;
}) {
  await requireAdmin();

  const data = {
    code: input.code.trim(),
    name: input.name?.trim() || null,
    marketId: input.marketId || null,
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
  tongTypeId: string;
}) {
  await requireAdmin();

  if (input.id) {
    await prisma.shipperStallDefault.update({
      where: { id: input.id },
      data: {
        shipperId: input.shipperId,
        stallId: input.stallId,
        tongTypeId: input.tongTypeId,
      },
    });
  } else {
    await prisma.shipperStallDefault.create({
      data: {
        shipperId: input.shipperId,
        stallId: input.stallId,
        tongTypeId: input.tongTypeId,
      },
    });
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
  capacityTong?: number;
  defaultDriverId?: string | null;
  sortOrder?: number | null;
  active: boolean;
}) {
  await requireAdmin();

  const data = {
    plate: input.plate.trim().toUpperCase(),
    type: input.type,
    capacityTong: input.capacityTong ?? null,
    defaultDriverId: input.defaultDriverId || null,
    sortOrder: input.sortOrder ?? null,
    active: input.active,
  };

  if (input.id) {
    await prisma.truck.update({ where: { id: input.id }, data });
  } else {
    await prisma.truck.create({ data });
  }

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
