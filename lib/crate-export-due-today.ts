import {
  resolveInboundCrateStockAccount,
  usesOfficePoolInboundStock,
} from "@/lib/inbound-crate-stock-account";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import type { LocationPoolShipperIds } from "@/lib/location-pool-shippers-service";

export type CrateQtyByCode = Record<string, number>;

export interface CrateExportPrefillTarget {
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  date: string;
  location: string;
  areaNote: string;
}

export interface CrateExportDueRow {
  key: string;
  label: string;
  due: CrateQtyByCode;
  returned: CrateQtyByCode;
  owed: CrateQtyByCode;
  totalDue: number;
  totalReturned: number;
  totalOwed: number;
  prefill: CrateExportPrefillTarget;
}

export interface CrateExportDueAgentGroup {
  kind: "agent";
  key: string;
  agentId: string;
  agentCode: string;
  agentName: string;
  due: CrateQtyByCode;
  returned: CrateQtyByCode;
  owed: CrateQtyByCode;
  totalDue: number;
  totalReturned: number;
  totalOwed: number;
  prefill: CrateExportPrefillTarget;
  members: CrateExportDueRow[];
}

export interface CrateExportDuePoolGroup {
  kind: "pool";
  key: string;
  poolShipperId: string;
  poolCode: string;
  poolName: string;
  pickup: "SONGKHLA" | "PATTANI";
  due: CrateQtyByCode;
  returned: CrateQtyByCode;
  owed: CrateQtyByCode;
  totalDue: number;
  totalReturned: number;
  totalOwed: number;
  prefill: CrateExportPrefillTarget;
  members: CrateExportDueRow[];
}

export type CrateExportDueItem =
  | { kind: "row"; row: CrateExportDueRow }
  | { kind: "agent"; group: CrateExportDueAgentGroup }
  | { kind: "pool"; group: CrateExportDuePoolGroup };

export interface CrateExportDueTodayData {
  date: string;
  items: CrateExportDueItem[];
  inTransitNote: null;
}

type QtyMap = Map<string, number>;

export interface BuildCrateExportDueTodayInput {
  date: string;
  poolIds: LocationPoolShipperIds;
  /** agentShipperId → { code, name, isPool } */
  agents: Map<
    string,
    { code: string; name: string; isPool: boolean; pickup?: "SONGKHLA" | "PATTANI" }
  >;
  /** memberShipperId → agentShipperId */
  membershipByMemberId: Map<string, string>;
  /** shipperId → isMultiOrigin */
  multiOriginByShipperId: Map<string, boolean>;
  shippers: Map<string, { code: string; name: string }>;
  inboundSessions: {
    shipperId: string;
    sessionDate: Date;
    pickupLocation: string | null;
    shipperPickupLocation: string;
    customerOriginLocation: string | null;
    areaNote: string | null;
    lines: {
      tongCode: string;
      quantity: number;
      trackInventory: boolean;
      isBox: boolean;
    }[];
  }[];
  exportsByShipperId: Map<string, QtyMap>;
  /** key `${shipperId}|${location}` for multi-origin ledger returns */
  exportsByShipperLocation: Map<string, QtyMap>;
}

function emptyQty(): QtyMap {
  return new Map();
}

function addQty(map: QtyMap, code: string, qty: number) {
  if (qty <= 0) return;
  map.set(code, (map.get(code) ?? 0) + qty);
}

function sumMaps(maps: QtyMap[]): QtyMap {
  const out = emptyQty();
  for (const m of maps) {
    for (const [code, qty] of Array.from(m.entries())) {
      addQty(out, code, qty);
    }
  }
  return out;
}

function subtractQty(due: QtyMap, returned: QtyMap): QtyMap {
  const owed = emptyQty();
  for (const [code, d] of Array.from(due.entries())) {
    const o = d - (returned.get(code) ?? 0);
    if (o > 0) owed.set(code, o);
  }
  return owed;
}

function totalOf(map: QtyMap): number {
  let s = 0;
  for (const v of Array.from(map.values())) s += v;
  return s;
}

export function qtyMapToRecord(map: QtyMap): CrateQtyByCode {
  const rec: CrateQtyByCode = {};
  for (const [code, qty] of Array.from(map.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    rec[code] = qty;
  }
  return rec;
}

function formatQtySummary(map: QtyMap): string {
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, qty]) => `${code} ${qty}`)
    .join(" / ");
}

function makePrefill(
  date: string,
  shipper: { id: string; code: string; name: string },
  location: string,
  areaNote = ""
): CrateExportPrefillTarget {
  return {
    shipperId: shipper.id,
    shipperCode: shipper.code,
    shipperName: shipper.name,
    date,
    location,
    areaNote,
  };
}

function buildRow(
  key: string,
  label: string,
  due: QtyMap,
  returned: QtyMap,
  prefill: CrateExportPrefillTarget
): CrateExportDueRow | null {
  const owed = subtractQty(due, returned);
  const totalOwed = totalOf(owed);
  if (totalOwed <= 0) return null;
  return {
    key,
    label,
    due: qtyMapToRecord(due),
    returned: qtyMapToRecord(returned),
    owed: qtyMapToRecord(owed),
    totalDue: totalOf(due),
    totalReturned: totalOf(returned),
    totalOwed,
    prefill,
  };
}

export function buildCrateExportDueToday(
  input: BuildCrateExportDueTodayInput
): CrateExportDueTodayData {
  const { date } = input;

  type MemberInbound = {
    memberId: string;
    memberCode: string;
    memberName: string;
    agentId: string;
    poolPickup?: "SONGKHLA" | "PATTANI";
    due: QtyMap;
    location: string;
    areaNote: string;
    isMultiOrigin: boolean;
    origin?: string;
  };

  const standaloneDue = new Map<string, QtyMap>();
  const multiOriginDue = new Map<string, { due: QtyMap; origin: string; areaNote: string }>();
  const memberInbounds: MemberInbound[] = [];

  for (const session of input.inboundSessions) {
    const shipper = input.shippers.get(session.shipperId);
    if (!shipper) continue;

    const agentId = input.membershipByMemberId.get(session.shipperId);
    const agent = agentId ? input.agents.get(agentId) : undefined;
    const isMulti = input.multiOriginByShipperId.get(session.shipperId) ?? false;
    const origin = session.customerOriginLocation?.trim() || "";

    const poolAccount = resolveInboundCrateStockAccount({
      sessionDate: session.sessionDate,
      operationalShipperId: session.shipperId,
      sessionPickupLocation: session.pickupLocation,
      shipperPickupLocation: session.shipperPickupLocation,
      areaNote: session.areaNote,
      poolIds: input.poolIds,
    });

    const effectivePickup = resolveSessionPickupLocation(
      session.pickupLocation,
      session.shipperPickupLocation
    );
    const usesPool =
      usesOfficePoolInboundStock(session.sessionDate) &&
      (effectivePickup === "SONGKHLA" || effectivePickup === "PATTANI");

    const memberDue = emptyQty();
    for (const line of session.lines) {
      if (!line.trackInventory || line.isBox) continue;
      addQty(memberDue, line.tongCode, line.quantity);
    }
    if (totalOf(memberDue) === 0) continue;

    if (usesPool && agent?.isPool) {
      memberInbounds.push({
        memberId: session.shipperId,
        memberCode: shipper.code,
        memberName: shipper.name,
        agentId: agentId!,
        poolPickup: effectivePickup as "SONGKHLA" | "PATTANI",
        due: memberDue,
        location: poolAccount.location,
        areaNote: session.areaNote?.trim() ?? "",
        isMultiOrigin: false,
      });
      continue;
    }

    if (agent && !agent.isPool) {
      memberInbounds.push({
        memberId: session.shipperId,
        memberCode: shipper.code,
        memberName: shipper.name,
        agentId: agentId!,
        due: memberDue,
        location: origin || poolAccount.location,
        areaNote: session.areaNote?.trim() ?? "",
        isMultiOrigin: isMulti,
        origin: origin || undefined,
      });
      continue;
    }

    if (isMulti && origin) {
      const k = `${session.shipperId}|${origin}`;
      const cur = multiOriginDue.get(k) ?? {
        due: emptyQty(),
        origin,
        areaNote: session.areaNote?.trim() ?? "",
      };
      for (const [code, qty] of Array.from(memberDue.entries())) {
        addQty(cur.due, code, qty);
      }
      multiOriginDue.set(k, cur);
      continue;
    }

    const k = session.shipperId;
    const cur = standaloneDue.get(k) ?? emptyQty();
    for (const [code, qty] of Array.from(memberDue.entries())) {
      addQty(cur, code, qty);
    }
    standaloneDue.set(k, cur);
  }

  const items: CrateExportDueItem[] = [];

  for (const [shipperId, due] of Array.from(standaloneDue.entries())) {
    const shipper = input.shippers.get(shipperId);
    if (!shipper) continue;
    const returned = input.exportsByShipperId.get(shipperId) ?? emptyQty();
    const row = buildRow(
      `standalone:${shipperId}`,
      shipper.name,
      due,
      returned,
      makePrefill(date, { id: shipperId, ...shipper }, "")
    );
    if (row) items.push({ kind: "row", row });
  }

  for (const [key, { due, origin, areaNote }] of Array.from(
    multiOriginDue.entries()
  )) {
    const [shipperId] = key.split("|");
    const shipper = input.shippers.get(shipperId);
    if (!shipper) continue;
    const returned =
      input.exportsByShipperLocation.get(`${shipperId}|${origin}`) ?? emptyQty();
    const row = buildRow(
      `multi:${shipperId}:${origin}`,
      `${shipper.name} — ${origin}`,
      due,
      returned,
      makePrefill(date, { id: shipperId, ...shipper }, origin, areaNote)
    );
    if (row) items.push({ kind: "row", row });
  }

  const membersByAgent = new Map<string, MemberInbound[]>();
  for (const m of memberInbounds) {
    const list = membersByAgent.get(m.agentId) ?? [];
    list.push(m);
    membersByAgent.set(m.agentId, list);
  }

  for (const [agentId, members] of Array.from(membersByAgent.entries())) {
    const agent = input.agents.get(agentId);
    if (!agent) continue;

    if (agent.isPool && agent.pickup) {
      const poolShipperId = input.poolIds[agent.pickup];
      const poolReturned =
        input.exportsByShipperId.get(poolShipperId) ?? emptyQty();

      const memberRows: CrateExportDueRow[] = [];
      const memberDueMaps: QtyMap[] = [];

      for (const m of members) {
        const returned = input.exportsByShipperId.get(m.memberId) ?? emptyQty();
        memberDueMaps.push(m.due);
        const row = buildRow(
          `pool-member:${agentId}:${m.memberId}`,
          m.memberName,
          m.due,
          returned,
          makePrefill(
            date,
            { id: m.memberId, code: m.memberCode, name: m.memberName },
            m.location,
            m.areaNote
          )
        );
        if (row) memberRows.push(row);
      }

      const totalDue = sumMaps(memberDueMaps);
      const owed = subtractQty(totalDue, poolReturned);
      const totalOwed = totalOf(owed);
      if (totalOwed <= 0 && memberRows.length === 0) continue;

      if (totalOwed > 0) {
        items.push({
          kind: "pool",
          group: {
            kind: "pool",
            key: `pool:${agentId}`,
            poolShipperId,
            poolCode: agent.code,
            poolName: agent.name,
            pickup: agent.pickup,
            due: qtyMapToRecord(totalDue),
            returned: qtyMapToRecord(poolReturned),
            owed: qtyMapToRecord(owed),
            totalDue: totalOf(totalDue),
            totalReturned: totalOf(poolReturned),
            totalOwed,
            prefill: makePrefill(
              date,
              { id: poolShipperId, code: agent.code, name: agent.name },
              agent.pickup
            ),
            members: memberRows.sort((a, b) => a.label.localeCompare(b.label)),
          },
        });
      }
      continue;
    }

    const memberRows: CrateExportDueRow[] = [];
    const memberDueMaps: QtyMap[] = [];
    const memberReturnedMaps: QtyMap[] = [];
    const exportShipperIds = new Set<string>([agentId]);

    for (const m of members) {
      exportShipperIds.add(m.memberId);
      let returned = input.exportsByShipperId.get(m.memberId) ?? emptyQty();
      if (m.isMultiOrigin && m.origin) {
        returned =
          input.exportsByShipperLocation.get(`${m.memberId}|${m.origin}`) ??
          returned;
      }
      memberReturnedMaps.push(returned);
      memberDueMaps.push(m.due);

      const label =
        m.isMultiOrigin && m.origin
          ? `${m.memberName} — ${m.origin}`
          : m.memberName;
      const row = buildRow(
        `agent-member:${agentId}:${m.memberId}:${m.origin ?? ""}`,
        label,
        m.due,
        returned,
        makePrefill(
          date,
          { id: m.memberId, code: m.memberCode, name: m.memberName },
          m.isMultiOrigin && m.origin ? m.origin : m.location,
          m.areaNote
        )
      );
      if (row) memberRows.push(row);
    }

    const agentReturned = input.exportsByShipperId.get(agentId) ?? emptyQty();
    const totalDue = sumMaps(memberDueMaps);
    const allReturned = sumMaps([agentReturned, ...memberReturnedMaps]);
    const owed = subtractQty(totalDue, allReturned);
    const totalOwed = totalOf(owed);
    if (totalOwed <= 0 && memberRows.length === 0) continue;

    if (totalOwed > 0) {
      items.push({
        kind: "agent",
        group: {
          kind: "agent",
          key: `agent:${agentId}`,
          agentId,
          agentCode: agent.code,
          agentName: agent.name,
          due: qtyMapToRecord(totalDue),
          returned: qtyMapToRecord(allReturned),
          owed: qtyMapToRecord(owed),
          totalDue: totalOf(totalDue),
          totalReturned: totalOf(allReturned),
          totalOwed,
          prefill: makePrefill(
            date,
            { id: agentId, code: agent.code, name: agent.name },
            ""
          ),
          members: memberRows.sort((a, b) => a.label.localeCompare(b.label)),
        },
      });
    }
  }

  items.sort((a, b) => {
    const labelA =
      a.kind === "row"
        ? a.row.label
        : a.kind === "agent"
          ? a.group.agentName
          : a.group.poolName;
    const labelB =
      b.kind === "row"
        ? b.row.label
        : b.kind === "agent"
          ? b.group.agentName
          : b.group.poolName;
    return labelA.localeCompare(labelB);
  });

  return { date, items, inTransitNote: null };
}

export { formatQtySummary };
