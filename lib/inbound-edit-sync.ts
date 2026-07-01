import type { InboundLineInput } from "@/lib/inbound-utils";
import {
  formatPickupLocationLabel,
  resolveSessionPickupLocation,
} from "@/lib/constants/pickup-locations";
import {
  resolveCustomerCrateStockAccount,
  type CustomerCrateStockAccount,
} from "@/lib/customer-crate-stock-account";
import type { LocationPoolShipperIds } from "@/lib/location-pool-shippers-service";

type TongTypeMeta = { trackInventory: boolean; isBox: boolean };

export interface InboundLineSnapshot {
  id: string;
  quantity: number;
  tongTypeId: string;
  stallId: string;
  originalQuantity: number | null;
  stallCode: string;
  marketCode: string;
  tongTypeCode: string;
  tongTypeName: string;
}

export interface InboundSessionSnapshot {
  date: Date;
  shipperId: string;
  shipperName: string;
  shipperPickupLocation: string;
  pickupLocation: string | null;
  areaNote: string | null;
  customerOriginLocation?: string | null;
  thVehiclePlate: string | null;
  lines: InboundLineSnapshot[];
}

export interface InboundChangeLogInput {
  sessionId: string;
  lineId?: string | null;
  userId: string;
  field: string;
  fromValue: string;
  toValue: string;
}

export function aggregateCrateQuantities(
  lines: { tongTypeId: string; quantity: number }[],
  typeMap: Map<string, TongTypeMeta>
) {
  const byCrateType = new Map<string, number>();
  for (const line of lines) {
    const crateType = typeMap.get(line.tongTypeId);
    if (!crateType?.trackInventory || crateType.isBox) continue;
    byCrateType.set(
      line.tongTypeId,
      (byCrateType.get(line.tongTypeId) ?? 0) + line.quantity
    );
  }
  return byCrateType;
}

function stallLabel(marketCode: string, stallCode: string) {
  return marketCode ? `${marketCode}/${stallCode}` : stallCode;
}

function pickupLabel(
  pickupLocation: string | null | undefined,
  shipperPickupLocation: string | null | undefined
) {
  return formatPickupLocationLabel(
    resolveSessionPickupLocation(pickupLocation, shipperPickupLocation)
  );
}

export function buildInboundChangeLogs(input: {
  sessionId: string;
  userId: string;
  before: InboundSessionSnapshot;
  after: {
    date: Date;
    shipperId: string;
    shipperName: string;
    shipperPickupLocation: string;
    pickupLocation: string | null;
    areaNote: string | null;
    thVehiclePlate: string | null;
    lines: InboundLineInput[];
  };
  afterLineMeta: Map<
    string,
    { stallCode: string; marketCode: string }
  >;
  afterTongMeta: Map<string, { tongTypeCode: string; tongTypeName: string }>;
}): InboundChangeLogInput[] {
  const logs: InboundChangeLogInput[] = [];
  const { sessionId, userId, before, after, afterLineMeta, afterTongMeta } =
    input;

  const push = (
    field: string,
    fromValue: string,
    toValue: string,
    lineId?: string | null
  ) => {
    if (fromValue === toValue) return;
    logs.push({ sessionId, lineId, userId, field, fromValue, toValue });
  };

  push(
    "日期 Date",
    before.date.toISOString().slice(0, 10),
    after.date.toISOString().slice(0, 10)
  );
  push("寄货人 Consignor", before.shipperName, after.shipperName);
  push(
    "收货地点 Pickup",
    pickupLabel(before.pickupLocation, before.shipperPickupLocation),
    pickupLabel(after.pickupLocation, after.shipperPickupLocation)
  );
  push("地区 Area", before.areaNote?.trim() ?? "", after.areaNote?.trim() ?? "");
  push(
    "泰国车牌 TH Plate",
    before.thVehiclePlate?.trim() ?? "",
    after.thVehiclePlate?.trim() ?? ""
  );

  const beforeById = new Map(before.lines.map((line) => [line.id, line]));
  const afterById = new Map(
    after.lines.filter((line) => line.lineId).map((line) => [line.lineId!, line])
  );

  for (const [lineId, prev] of Array.from(beforeById.entries())) {
    const next = afterById.get(lineId);
    if (!next) {
      push(
        "桶数 Crates",
        String(prev.quantity),
        "0",
        null
      );
      continue;
    }

    if (prev.quantity !== next.quantity) {
      push("桶数 Crates", String(prev.quantity), String(next.quantity), lineId);
    }

    if (prev.tongTypeId !== next.tongTypeId) {
      const nextTong = afterTongMeta.get(next.tongTypeId);
      push(
        "桶型 Crate Type",
        `${prev.tongTypeCode} (${prev.tongTypeName})`,
        nextTong
          ? `${nextTong.tongTypeCode} (${nextTong.tongTypeName})`
          : next.tongTypeId,
        lineId
      );
    }

    if (prev.stallId !== next.stallId) {
      const nextStall = afterLineMeta.get(next.stallId);
      push(
        "收货人 Receiver",
        stallLabel(prev.marketCode, prev.stallCode),
        nextStall
          ? stallLabel(nextStall.marketCode, nextStall.stallCode)
          : next.stallId,
        lineId
      );
    }
  }

  for (const line of after.lines) {
    if (line.lineId && beforeById.has(line.lineId)) continue;
    const stall = afterLineMeta.get(line.stallId);
    const tong = afterTongMeta.get(line.tongTypeId);
    push("桶数 Crates", "0", String(line.quantity), line.lineId ?? null);
    if (stall) {
      push(
        "收货人 Receiver",
        "",
        stallLabel(stall.marketCode, stall.stallCode),
        line.lineId ?? null
      );
    }
    if (tong) {
      push(
        "桶型 Crate Type",
        "",
        `${tong.tongTypeCode} (${tong.tongTypeName})`,
        line.lineId ?? null
      );
    }
  }

  return logs;
}

export function resolveCrateStockBucket(
  sessionDate: Date,
  operationalShipperId: string,
  shipperPickupLocation: string | null | undefined,
  sessionPickupLocation: string | null | undefined,
  areaNote: string | null | undefined,
  poolIds: LocationPoolShipperIds,
  agentMembershipByMemberId?:
    | ReadonlyMap<string, string>
    | Record<string, string>,
  customerOriginLocation?: string | null,
  isMultiOriginCustomer?: boolean
): CustomerCrateStockAccount {
  return resolveCustomerCrateStockAccount({
    sessionDate,
    operationalShipperId,
    sessionPickupLocation,
    shipperPickupLocation,
    areaNote: isMultiOriginCustomer ? areaNote : null,
    customerOriginLocation,
    isMultiOriginCustomer,
    poolIds,
    agentMembershipByMemberId,
  });
}

export interface CrateStockAdjustment {
  shipperId: string;
  location: string;
  crateTypeId: string;
  delta: number;
}

export function computeCrateStockAdjustments(input: {
  beforeLines: { tongTypeId: string; quantity: number }[];
  afterLines: { tongTypeId: string; quantity: number }[];
  beforeBucket: { shipperId: string; location: string };
  afterBucket: { shipperId: string; location: string };
  typeMap: Map<string, TongTypeMeta>;
}): CrateStockAdjustment[] {
  const { beforeLines, afterLines, beforeBucket, afterBucket, typeMap } = input;
  const sameBucket =
    beforeBucket.shipperId === afterBucket.shipperId &&
    beforeBucket.location === afterBucket.location;

  if (!sameBucket) {
    const adjustments: CrateStockAdjustment[] = [];
    for (const [crateTypeId, quantity] of Array.from(
      aggregateCrateQuantities(beforeLines, typeMap).entries()
    )) {
      adjustments.push({
        shipperId: beforeBucket.shipperId,
        location: beforeBucket.location,
        crateTypeId,
        delta: quantity,
      });
    }
    for (const [crateTypeId, quantity] of Array.from(
      aggregateCrateQuantities(afterLines, typeMap).entries()
    )) {
      adjustments.push({
        shipperId: afterBucket.shipperId,
        location: afterBucket.location,
        crateTypeId,
        delta: -quantity,
      });
    }
    return adjustments;
  }

  const before = aggregateCrateQuantities(beforeLines, typeMap);
  const after = aggregateCrateQuantities(afterLines, typeMap);
  const typeIds = new Set<string>([
    ...Array.from(before.keys()),
    ...Array.from(after.keys()),
  ]);
  const adjustments: CrateStockAdjustment[] = [];

  for (const crateTypeId of Array.from(typeIds)) {
    const borrowDelta =
      (after.get(crateTypeId) ?? 0) - (before.get(crateTypeId) ?? 0);
    if (borrowDelta === 0) continue;
    // Agent stock: less borrowed → return (+); more borrowed → deduct (−).
    // borrowDelta is the change in borrowed qty; agent delta is the inverse.
    adjustments.push({
      shipperId: afterBucket.shipperId,
      location: afterBucket.location,
      crateTypeId,
      delta: -borrowDelta,
    });
  }

  return adjustments;
}
