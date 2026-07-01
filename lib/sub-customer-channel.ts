import { stockLocationForPoolShipperCode } from "@/lib/constants/location-pool-shippers";
import type { CustomerCrateStockAccount } from "@/lib/customer-crate-stock-account";

export type SubCustomerChannelOwnerType = "self" | "agent" | "pool";

export interface SubCustomerChannelRecord {
  id: string;
  parentShipperId: string;
  channelKey: string;
  label: string;
  ownerType: SubCustomerChannelOwnerType;
  ownerShipperId: string;
  ownerShipperCode: string;
  allowMultiOrigin: boolean;
  sortOrder: number;
}

export function subCustomerChannelMapKey(
  parentShipperId: string,
  channelKey: string
): string {
  return `${parentShipperId}:${channelKey}`;
}

export function resolveSubCustomerChannelStockAccount(input: {
  parentShipperId: string;
  channel: SubCustomerChannelRecord;
  customerOriginLocation?: string | null;
}): CustomerCrateStockAccount {
  const origin = input.customerOriginLocation?.trim() ?? "";

  if (input.channel.ownerType === "agent") {
    return {
      shipperId: input.channel.ownerShipperId,
      location: "",
    };
  }

  if (input.channel.ownerType === "pool") {
    const location =
      stockLocationForPoolShipperCode(input.channel.ownerShipperCode) ?? "";
    return {
      shipperId: input.channel.ownerShipperId,
      location,
    };
  }

  return {
    shipperId: input.parentShipperId,
    location:
      input.channel.allowMultiOrigin && origin ? origin : "",
  };
}

export function channelRequiresOriginSelection(
  channel: SubCustomerChannelRecord
): boolean {
  return channel.ownerType === "self" && channel.allowMultiOrigin;
}

export function toSubCustomerChannelRecord(row: {
  id: string;
  parentShipperId: string;
  channelKey: string;
  label: string;
  ownerType: string;
  ownerShipperId: string;
  allowMultiOrigin: boolean;
  sortOrder: number;
  ownerShipper: { code: string };
}): SubCustomerChannelRecord {
  const ownerType = row.ownerType as SubCustomerChannelOwnerType;
  if (ownerType !== "self" && ownerType !== "agent" && ownerType !== "pool") {
    throw new Error(`Invalid sub-customer channel ownerType: ${row.ownerType}`);
  }
  return {
    id: row.id,
    parentShipperId: row.parentShipperId,
    channelKey: row.channelKey,
    label: row.label,
    ownerType,
    ownerShipperId: row.ownerShipperId,
    ownerShipperCode: row.ownerShipper.code,
    allowMultiOrigin: row.allowMultiOrigin,
    sortOrder: row.sortOrder,
  };
}
