import { toDateInputValue } from "@/lib/inbound-utils";
import type { InboundFreightLine } from "@/components/inbound/InboundFreightPanel";
import type { McDeliveryMode } from "@/lib/inbound-freight";
import { decimalToNumber } from "@/lib/freight-rates";

function serializeMoney(value: unknown): number | null {
  return decimalToNumber(value);
}

export interface InboundFormInitialSession {
  id: string;
  date: string;
  shipperId: string;
  thVehiclePlate: string | null;
  areaNote?: string | null;
  customerOriginLocation?: string | null;
  subChannelKey?: string | null;
  pickupLocation?: string | null;
  shipperPickupLocation?: string;
  status: string;
  lines: {
    id: string;
    stallId: string;
    stallCode: string;
    marketCode: string;
    tongTypeId: string;
    quantity: number;
    mcDeliveryMode?: McDeliveryMode | null;
  }[];
}

type InboundSessionLineSource = {
  id: string;
  stallId: string;
  stallCode: string;
  marketCode: string;
  tongTypeId: string;
  tongTypeCode?: string;
  quantity: number;
  mcDeliveryMode?: McDeliveryMode | null;
  paymentParty?: "shipper" | "consignee" | null;
  paymentMode?: string | null;
  currency?: string | null;
  billingCompany?: string | null;
  freightRate?: number | null;
  freightAmount?: number | null;
  thirdPartyFee?: number | null;
  mySegmentFreightRate?: number | null;
  mySegmentFreightAmount?: number | null;
  thFreightRate?: number | null;
  thFreightAmount?: number | null;
};

export function serializeInboundFormInitialSession(session: {
  id: string;
  date: string | Date;
  shipperId: string;
  thVehiclePlate: string | null;
  areaNote: string | null;
  customerOriginLocation?: string | null;
  subChannelKey?: string | null;
  pickupLocation: string | null;
  shipperPickupLocation: string;
  status: string;
  lines: InboundSessionLineSource[];
}): InboundFormInitialSession {
  return {
    id: session.id,
    date:
      typeof session.date === "string"
        ? session.date
        : toDateInputValue(new Date(session.date)),
    shipperId: session.shipperId,
    thVehiclePlate: session.thVehiclePlate,
    areaNote: session.areaNote,
    customerOriginLocation: session.customerOriginLocation,
    subChannelKey: session.subChannelKey,
    pickupLocation: session.pickupLocation,
    shipperPickupLocation: session.shipperPickupLocation,
    status: session.status,
    lines: session.lines.map((line) => ({
      id: line.id,
      stallId: line.stallId,
      stallCode: line.stallCode,
      marketCode: line.marketCode,
      tongTypeId: line.tongTypeId,
      quantity: Number(line.quantity) || 0,
      mcDeliveryMode: line.mcDeliveryMode ?? undefined,
    })),
  };
}

export function serializeInboundFreightLines(
  lines: InboundSessionLineSource[]
): InboundFreightLine[] {
  const serialized = lines.map((line) => ({
    id: line.id,
    stallCode: line.stallCode,
    marketCode: line.marketCode,
    tongTypeCode: line.tongTypeCode ?? "",
    quantity: Number(line.quantity) || 0,
    mcDeliveryMode: line.mcDeliveryMode ?? null,
    paymentParty: line.paymentParty ?? null,
    paymentMode: line.paymentMode ?? null,
    currency: line.currency ?? null,
    billingCompany: line.billingCompany ?? null,
    freightRate: serializeMoney(line.freightRate),
    freightAmount: serializeMoney(line.freightAmount),
    thirdPartyFee: serializeMoney(line.thirdPartyFee),
    mySegmentFreightRate: serializeMoney(line.mySegmentFreightRate),
    mySegmentFreightAmount: serializeMoney(line.mySegmentFreightAmount),
    thFreightRate: serializeMoney(line.thFreightRate),
    thFreightAmount: serializeMoney(line.thFreightAmount),
  }));

  return JSON.parse(JSON.stringify(serialized)) as InboundFreightLine[];
}

export function serializeShipperOptions(
  shippers: {
    id: string;
    code: string;
    name: string;
    pickupLocation: string;
    defaultTongTypeId: string | null;
  }[]
) {
  return shippers.map((shipper) => ({
    id: shipper.id,
    code: shipper.code,
    name: shipper.name,
    pickupLocation: shipper.pickupLocation,
    defaultTongTypeId: shipper.defaultTongTypeId,
  }));
}

export function serializeTongTypeOptions(
  tongTypes: { id: string; code: string; name: string }[]
) {
  return tongTypes.map((tongType) => ({
    id: tongType.id,
    code: tongType.code,
    name: tongType.name,
  }));
}

export function serializeMarketOptions(
  markets: {
    id: string;
    code: string;
    name: string;
    displayName?: string;
  }[]
) {
  return markets.map((market) => ({
    id: market.id,
    code: market.code,
    name: market.name,
    displayName: market.displayName ?? market.name,
  }));
}
