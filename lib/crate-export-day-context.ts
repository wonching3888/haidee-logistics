import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/inbound-utils";
import { getBangkokDayUtcRange } from "@/lib/date-utils";
import {
  buildCrateExportDueToday,
  type BuildCrateExportDueTodayInput,
} from "@/lib/crate-export-due-today";
import {
  buildLiveOwedIndexFromDueToday,
  type LiveOwedIndex,
} from "@/lib/crate-export-live-owed";
import { stockLocationForPoolShipperCode } from "@/lib/constants/location-pool-shippers";
import { SHIPPER_KIND } from "@/lib/constants/shipper-kind";
import { loadLocationPoolShipperIds } from "@/lib/location-pool-shippers-service";
import {
  subCustomerChannelMapKey,
  toSubCustomerChannelRecord,
} from "@/lib/sub-customer-channel";

/** Load due-today input for a calendar day (shared by due-today list and live owed). */
export async function loadCrateExportDayInput(
  dateInput: string
): Promise<BuildCrateExportDueTodayInput> {
  const sessionDate = parseDateInput(dateInput);
  const { start: ledgerStart, end: ledgerEnd } = getBangkokDayUtcRange(dateInput);

  const [
    poolIds,
    membershipRows,
    agentShippers,
    multiOriginShippers,
    inboundSessions,
    exports,
    ledgerExports,
    subChannelRows,
  ] = await Promise.all([
    loadLocationPoolShipperIds(),
    prisma.crateStockAgentMember.findMany({
      select: { agentShipperId: true, memberShipperId: true },
    }),
    prisma.shipper.findMany({
      where: { shipperKind: SHIPPER_KIND.CRATE_STOCK_AGENT },
      select: { id: true, code: true, name: true },
    }),
    prisma.shipper.findMany({
      where: { isMultiOriginCustomer: true },
      select: { id: true },
    }),
    prisma.inboundSession.findMany({
      where: { date: sessionDate, status: "confirmed" },
      include: {
        shipper: {
          select: { id: true, code: true, name: true, pickupLocation: true },
        },
        lines: {
          include: {
            tongType: {
              select: { code: true, trackInventory: true, isBox: true },
            },
          },
        },
      },
    }),
    prisma.tongExport.findMany({
      where: { date: sessionDate },
      include: { tongType: { select: { code: true } } },
    }),
    prisma.customerCrateLedger.findMany({
      where: {
        changeType: "export",
        createdAt: { gte: ledgerStart, lt: ledgerEnd },
      },
      include: { crateType: { select: { code: true } } },
    }),
    prisma.subCustomerChannel.findMany({
      where: { active: true },
      include: {
        ownerShipper: { select: { id: true, code: true, name: true } },
      },
    }),
  ]);

  const shippers = new Map<string, { code: string; name: string }>();
  for (const s of inboundSessions) {
    shippers.set(s.shipper.id, { code: s.shipper.code, name: s.shipper.name });
  }
  for (const a of agentShippers) {
    shippers.set(a.id, { code: a.code, name: a.name });
  }

  const subChannelsByKey = new Map<
    string,
    ReturnType<typeof toSubCustomerChannelRecord>
  >();
  for (const row of subChannelRows) {
    const channel = toSubCustomerChannelRecord(row);
    subChannelsByKey.set(
      subCustomerChannelMapKey(row.parentShipperId, row.channelKey),
      channel
    );
    shippers.set(channel.ownerShipperId, {
      code: row.ownerShipper.code,
      name: row.ownerShipper.name,
    });
  }

  const agents = new Map<
    string,
    { code: string; name: string; isPool: boolean; pickup?: "SONGKHLA" | "PATTANI" }
  >();
  for (const a of agentShippers) {
    const pickup = stockLocationForPoolShipperCode(a.code) ?? undefined;
    agents.set(a.id, {
      code: a.code,
      name: a.name,
      isPool: Boolean(pickup),
      pickup: pickup ?? undefined,
    });
  }

  const membershipByMemberId = new Map<string, string>();
  for (const m of membershipRows) {
    membershipByMemberId.set(m.memberShipperId, m.agentShipperId);
  }

  const multiOriginByShipperId = new Map<string, boolean>();
  for (const s of multiOriginShippers) {
    multiOriginByShipperId.set(s.id, true);
  }

  const exportsByShipperId = new Map<string, Map<string, number>>();
  for (const row of exports) {
    if (row.quantityActual <= 0) continue;
    const map = exportsByShipperId.get(row.shipperId) ?? new Map();
    map.set(row.tongType.code, (map.get(row.tongType.code) ?? 0) + row.quantityActual);
    exportsByShipperId.set(row.shipperId, map);
  }

  const exportsByShipperLocation = new Map<string, Map<string, number>>();
  for (const row of ledgerExports) {
    if (row.quantity <= 0) continue;
    const loc = row.location?.trim() ?? "";
    const key = `${row.shipperId}|${loc}`;
    const map = exportsByShipperLocation.get(key) ?? new Map();
    map.set(row.crateType.code, (map.get(row.crateType.code) ?? 0) + row.quantity);
    exportsByShipperLocation.set(key, map);
  }

  return {
    date: dateInput,
    poolIds,
    agents,
    membershipByMemberId,
    multiOriginByShipperId,
    shippers,
    subChannelsByKey,
    inboundSessions: inboundSessions.map((s) => ({
      shipperId: s.shipperId,
      subChannelKey: s.subChannelKey,
      sessionDate: s.date,
      pickupLocation: s.pickupLocation,
      shipperPickupLocation: s.shipper.pickupLocation,
      customerOriginLocation: s.customerOriginLocation,
      areaNote: s.areaNote,
      lines: s.lines.map((l) => ({
        tongCode: l.tongType.code,
        quantity: l.quantity,
        trackInventory: l.tongType.trackInventory,
        isBox: l.tongType.isBox,
      })),
    })),
    exportsByShipperId,
    exportsByShipperLocation,
  };
}

export async function loadLiveOwedIndex(dateInput: string): Promise<LiveOwedIndex> {
  const input = await loadCrateExportDayInput(dateInput);
  const dueToday = buildCrateExportDueToday(input);
  return buildLiveOwedIndexFromDueToday(dueToday.items);
}
