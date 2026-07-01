"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSettings } from "@/lib/auth-roles";
import { OPERATIONAL_SHIPPER_WHERE } from "@/lib/constants/shipper-kind";
import { stockLocationForPoolShipperCode } from "@/lib/constants/location-pool-shippers";
import {
  channelRequiresOriginSelection,
  toSubCustomerChannelRecord,
  type SubCustomerChannelOwnerType,
  type SubCustomerChannelRecord,
} from "@/lib/sub-customer-channel";

const CHANNEL_INCLUDE = {
  ownerShipper: { select: { id: true, code: true, name: true, shipperKind: true } },
} as const;

async function requireSubCustomerChannelAdmin() {
  const user = await getCurrentUser();
  if (!user || !canAccessSettings(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

export interface SubCustomerChannelOption {
  channelKey: string;
  label: string;
  ownerType: SubCustomerChannelOwnerType;
  allowMultiOrigin: boolean;
}

export async function listSubCustomerChannelsForShipper(
  parentShipperId: string
): Promise<SubCustomerChannelOption[]> {
  const rows = await prisma.subCustomerChannel.findMany({
    where: { parentShipperId, active: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: {
      channelKey: true,
      label: true,
      ownerType: true,
      allowMultiOrigin: true,
    },
  });
  return rows.map((row) => ({
    channelKey: row.channelKey,
    label: row.label,
    ownerType: row.ownerType as SubCustomerChannelOwnerType,
    allowMultiOrigin: row.allowMultiOrigin,
  }));
}

export async function shipperHasSubCustomerChannels(
  parentShipperId: string
): Promise<boolean> {
  const count = await prisma.subCustomerChannel.count({
    where: { parentShipperId, active: true },
  });
  return count > 0;
}

export async function loadSubCustomerChannelResolved(
  parentShipperId: string,
  channelKey: string | null | undefined
): Promise<SubCustomerChannelRecord | null> {
  const key = channelKey?.trim();
  if (!key) return null;

  const row = await prisma.subCustomerChannel.findFirst({
    where: {
      parentShipperId,
      channelKey: key,
      active: true,
    },
    include: CHANNEL_INCLUDE,
  });
  if (!row) {
    throw new Error(`无效子顾客渠道 Invalid sub-customer channel: ${key}`);
  }
  return toSubCustomerChannelRecord(row);
}

export async function validateInboundSubChannel(input: {
  parentShipperId: string;
  subChannelKey?: string | null;
  customerOriginLocation?: string | null;
  effectivePickup: string;
  isMultiOriginCustomer: boolean;
}): Promise<{
  subChannelKey: string | null;
  channel: SubCustomerChannelRecord | null;
  customerOriginLocation: string | null;
}> {
  const hasChannels = await shipperHasSubCustomerChannels(input.parentShipperId);
  const key = input.subChannelKey?.trim() || null;

  if (!hasChannels) {
    return {
      subChannelKey: null,
      channel: null,
      customerOriginLocation: input.customerOriginLocation?.trim() || null,
    };
  }

  if (!key) {
    throw new Error("请选择子顾客渠道 Please select a sub-customer channel");
  }

  const channel = await loadSubCustomerChannelResolved(input.parentShipperId, key);
  if (!channel) {
    throw new Error("无效子顾客渠道 Invalid sub-customer channel");
  }

  if (channel.ownerType !== "self") {
    return {
      subChannelKey: key,
      channel,
      customerOriginLocation: null,
    };
  }

  if (!channelRequiresOriginSelection(channel)) {
    return {
      subChannelKey: key,
      channel,
      customerOriginLocation: null,
    };
  }

  const { assertOriginInCustomerList } = await import("@/lib/multi-origin-customer");
  const rows = await prisma.customerOriginLocation.findMany({
    where: { shipperId: input.parentShipperId },
    orderBy: [{ sortOrder: "asc" }, { locationName: "asc" }],
    select: { locationName: true },
  });
  const origin = assertOriginInCustomerList(
    input.customerOriginLocation,
    rows.map((row) => row.locationName)
  );

  return {
    subChannelKey: key,
    channel,
    customerOriginLocation: origin,
  };
}

export interface SubCustomerChannelAdminRow {
  id: string;
  parentShipperId: string;
  parentShipperCode: string;
  parentShipperName: string;
  channelKey: string;
  label: string;
  ownerType: SubCustomerChannelOwnerType;
  ownerShipperId: string;
  ownerShipperCode: string;
  ownerShipperName: string;
  allowMultiOrigin: boolean;
  sortOrder: number;
  active: boolean;
}

export async function listSubCustomerChannelsAdmin(): Promise<
  SubCustomerChannelAdminRow[]
> {
  await requireSubCustomerChannelAdmin();
  const rows = await prisma.subCustomerChannel.findMany({
    orderBy: [
      { parentShipper: { name: "asc" } },
      { sortOrder: "asc" },
      { label: "asc" },
    ],
    include: {
      ...CHANNEL_INCLUDE,
      parentShipper: { select: { id: true, code: true, name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    parentShipperId: row.parentShipperId,
    parentShipperCode: row.parentShipper.code,
    parentShipperName: row.parentShipper.name,
    channelKey: row.channelKey,
    label: row.label,
    ownerType: row.ownerType as SubCustomerChannelOwnerType,
    ownerShipperId: row.ownerShipperId,
    ownerShipperCode: row.ownerShipper.code,
    ownerShipperName: row.ownerShipper.name,
    allowMultiOrigin: row.allowMultiOrigin,
    sortOrder: row.sortOrder,
    active: row.active,
  }));
}

export async function listParentShipperOptionsForSubChannels() {
  await requireSubCustomerChannelAdmin();
  return prisma.shipper.findMany({
    where: OPERATIONAL_SHIPPER_WHERE,
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, isMultiOriginCustomer: true },
  });
}

export async function listOwnerShipperOptionsForSubChannels() {
  await requireSubCustomerChannelAdmin();
  const [agents, pools, operational] = await Promise.all([
    prisma.shipper.findMany({
      where: { active: true, shipperKind: "crate_stock_agent" },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.shipper.findMany({
      where: {
        active: true,
        code: { in: ["LOC-SONGKHLA", "LOC-PATTANI"] },
      },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.shipper.findMany({
      where: OPERATIONAL_SHIPPER_WHERE,
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);
  return { agents, pools, operational };
}

function assertOwnerType(value: string): SubCustomerChannelOwnerType {
  if (value === "self" || value === "agent" || value === "pool") return value;
  throw new Error("无效归属类型 Invalid owner type");
}

async function validateChannelOwner(input: {
  parentShipperId: string;
  ownerType: SubCustomerChannelOwnerType;
  ownerShipperId: string;
  allowMultiOrigin: boolean;
}) {
  if (input.ownerType === "self") {
    if (input.ownerShipperId !== input.parentShipperId) {
      throw new Error("自己渠道归属须为母顾客 self owner must be parent shipper");
    }
    return;
  }

  const owner = await prisma.shipper.findUnique({
    where: { id: input.ownerShipperId },
    select: { id: true, code: true, shipperKind: true, active: true },
  });
  if (!owner?.active) {
    throw new Error("归属主体不存在 Invalid owner shipper");
  }

  if (input.ownerType === "agent") {
    if (owner.shipperKind !== "crate_stock_agent") {
      throw new Error("代理渠道须选择代理主体 agent owner must be crate stock agent");
    }
    if (input.allowMultiOrigin) {
      throw new Error("代理渠道不可多产地 agent channel cannot be multi-origin");
    }
    return;
  }

  if (!stockLocationForPoolShipperCode(owner.code)) {
    throw new Error("池渠道须选择宋卡/北大年池 shipper pool owner invalid");
  }
  if (input.allowMultiOrigin) {
    throw new Error("池渠道不可多产地 pool channel cannot be multi-origin");
  }
}

export async function saveSubCustomerChannel(input: {
  id?: string;
  parentShipperId: string;
  channelKey: string;
  label: string;
  ownerType: string;
  ownerShipperId: string;
  allowMultiOrigin?: boolean;
  sortOrder?: number;
  active?: boolean;
}) {
  await requireSubCustomerChannelAdmin();

  const parent = await prisma.shipper.findFirst({
    where: { id: input.parentShipperId, ...OPERATIONAL_SHIPPER_WHERE },
    select: { id: true },
  });
  if (!parent) {
    throw new Error("母顾客不存在 Parent shipper not found");
  }

  const ownerType = assertOwnerType(input.ownerType.trim());
  const channelKey = input.channelKey.trim();
  const label = input.label.trim();
  if (!channelKey || !label) {
    throw new Error("渠道键与名称必填 channel key and label are required");
  }

  const ownerShipperId =
    ownerType === "self" ? input.parentShipperId : input.ownerShipperId.trim();
  const allowMultiOrigin =
    ownerType === "self" ? Boolean(input.allowMultiOrigin) : false;

  await validateChannelOwner({
    parentShipperId: input.parentShipperId,
    ownerType,
    ownerShipperId,
    allowMultiOrigin,
  });

  const data = {
    parentShipperId: input.parentShipperId,
    channelKey,
    label,
    ownerType,
    ownerShipperId,
    allowMultiOrigin,
    sortOrder: input.sortOrder ?? 0,
    active: input.active ?? true,
  };

  if (input.id) {
    await prisma.subCustomerChannel.update({
      where: { id: input.id },
      data,
    });
  } else {
    await prisma.subCustomerChannel.create({ data });
  }

  revalidatePath("/settings/sub-customer-channels");
  revalidatePath("/inbound");
  return { ok: true as const };
}

export async function deleteSubCustomerChannel(id: string) {
  await requireSubCustomerChannelAdmin();
  await prisma.subCustomerChannel.delete({ where: { id } });
  revalidatePath("/settings/sub-customer-channels");
  return { ok: true as const };
}
