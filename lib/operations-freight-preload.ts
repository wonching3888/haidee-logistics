import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import type { InboundFreightContext } from "@/lib/inbound-freight";
import { toDateInputValue } from "@/lib/date-utils";
import type { OperationsAssignedInboundLine } from "@/lib/operations-inbound-lines";

type FreightCtxCache = InboundFreightContext;

function freightCtxCacheKey(
  shipperId: string,
  pickup: ReturnType<typeof resolveSessionPickupLocation>,
  asOfDate: Date
) {
  return `${shipperId}|${pickup}|${toDateInputValue(asOfDate)}`;
}

export async function preloadOperationsFreightContexts(
  lines: OperationsAssignedInboundLine[],
  asOfDate: Date
): Promise<Map<string, FreightCtxCache>> {
  const requirements = new Map<
    string,
    {
      shipperId: string;
      pickup: ReturnType<typeof resolveSessionPickupLocation>;
      stallIds: Set<string>;
      tongTypeIds: Set<string>;
    }
  >();

  const linesByShipper = new Map<string, OperationsAssignedInboundLine[]>();
  for (const line of lines) {
    const group = linesByShipper.get(line.session.shipperId) ?? [];
    group.push(line);
    linesByShipper.set(line.session.shipperId, group);
  }

  for (const [shipperId, shipperLines] of Array.from(linesByShipper.entries())) {
    const first = shipperLines[0];
    if (!first) continue;

    const pickup = resolveSessionPickupLocation(
      first.session.pickupLocation,
      first.session.shipper.pickupLocation
    );
    const key = freightCtxCacheKey(shipperId, pickup, asOfDate);
    const existing = requirements.get(key) ?? {
      shipperId,
      pickup,
      stallIds: new Set<string>(),
      tongTypeIds: new Set<string>(),
    };

    for (const line of shipperLines) {
      existing.stallIds.add(line.stallId);
      existing.tongTypeIds.add(line.tongTypeId);
    }
    requirements.set(key, existing);
  }

  const cache = new Map<string, FreightCtxCache>();
  await Promise.all(
    Array.from(requirements.entries()).map(async ([key, req]) => {
      const { ctx } = await loadInboundFreightContext(
        req.shipperId,
        Array.from(req.stallIds),
        Array.from(req.tongTypeIds),
        asOfDate,
        req.pickup
      );
      cache.set(key, ctx);
    })
  );
  return cache;
}

export function getOperationsFreightContext(
  cache: Map<string, FreightCtxCache>,
  line: OperationsAssignedInboundLine,
  asOfDate: Date,
  shipperLines: OperationsAssignedInboundLine[]
): FreightCtxCache {
  const first = shipperLines[0] ?? line;
  const pickup = resolveSessionPickupLocation(
    first.session.pickupLocation,
    first.session.shipper.pickupLocation
  );
  const key = freightCtxCacheKey(line.session.shipperId, pickup, asOfDate);
  const ctx = cache.get(key);
  if (!ctx) {
    throw new Error("运费上下文未预加载 Freight context not preloaded");
  }
  return ctx;
}
