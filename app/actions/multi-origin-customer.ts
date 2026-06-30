"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canAccessSettings } from "@/lib/auth-roles";
import { getCurrentUser } from "@/lib/auth";
import { requireWrite } from "@/lib/require-auth";
import {
  filterMultiOriginDropdownOptions,
  parseOriginLocationNames,
  type MultiOriginCustomerConfig,
} from "@/lib/multi-origin-customer";
import { OPERATIONAL_SHIPPER_WHERE } from "@/lib/constants/shipper-kind";

async function requireMultiOriginAdmin() {
  const user = await getCurrentUser();
  if (!user || !canAccessSettings(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

export interface MultiOriginCustomerSummary {
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  isMultiOrigin: boolean;
  locations: string[];
}

async function loadLocationsForShipper(shipperId: string): Promise<string[]> {
  const rows = await prisma.customerOriginLocation.findMany({
    where: { shipperId },
    orderBy: [{ sortOrder: "asc" }, { locationName: "asc" }],
    select: { locationName: true },
  });
  return filterMultiOriginDropdownOptions(
    rows.map((row) => row.locationName)
  );
}

export async function getMultiOriginConfig(
  shipperId: string
): Promise<MultiOriginCustomerConfig> {
  await requireWrite();
  const shipper = await prisma.shipper.findUnique({
    where: { id: shipperId },
    select: { isMultiOriginCustomer: true },
  });
  if (!shipper) {
    return { isMultiOrigin: false, locations: [] };
  }
  if (!shipper.isMultiOriginCustomer) {
    return { isMultiOrigin: false, locations: [] };
  }
  return {
    isMultiOrigin: true,
    locations: await loadLocationsForShipper(shipperId),
  };
}

export async function listMultiOriginCustomers(): Promise<
  MultiOriginCustomerSummary[]
> {
  await requireMultiOriginAdmin();
  const shippers = await prisma.shipper.findMany({
    where: {
      ...OPERATIONAL_SHIPPER_WHERE,
      isMultiOriginCustomer: true,
    },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, isMultiOriginCustomer: true },
  });

  const summaries: MultiOriginCustomerSummary[] = [];
  for (const shipper of shippers) {
    summaries.push({
      shipperId: shipper.id,
      shipperCode: shipper.code,
      shipperName: shipper.name,
      isMultiOrigin: shipper.isMultiOriginCustomer,
      locations: await loadLocationsForShipper(shipper.id),
    });
  }
  return summaries;
}

export async function saveMultiOriginCustomerConfig(input: {
  shipperId: string;
  isMultiOrigin: boolean;
  locations: string[];
}) {
  await requireMultiOriginAdmin();

  const shipper = await prisma.shipper.findFirst({
    where: { id: input.shipperId, ...OPERATIONAL_SHIPPER_WHERE },
    select: { id: true },
  });
  if (!shipper) {
    throw new Error("寄货人不存在 Shipper not found");
  }

  const locations = parseOriginLocationNames(input.locations);
  if (input.isMultiOrigin && locations.length === 0) {
    throw new Error("多产地客户至少需要一个标准产地 At least one origin is required");
  }

  await prisma.$transaction(async (tx) => {
    await tx.shipper.update({
      where: { id: input.shipperId },
      data: { isMultiOriginCustomer: input.isMultiOrigin },
    });

    await tx.customerOriginLocation.deleteMany({
      where: { shipperId: input.shipperId },
    });

    if (input.isMultiOrigin) {
      await tx.customerOriginLocation.createMany({
        data: locations.map((locationName, index) => ({
          shipperId: input.shipperId,
          locationName,
          sortOrder: index,
        })),
      });
    }
  });

  revalidatePath("/crate/customer-stock");
  return { ok: true as const };
}
