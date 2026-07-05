import {
  resolveInboundCrateStockAccount,
  usesOfficePoolInboundStock,
} from "@/lib/inbound-crate-stock-account";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { LOCATION_POOL_SHIPPER_CODES, stockLocationForPoolShipperCode } from "@/lib/constants/location-pool-shippers";
import type { LocationPoolShipperIds } from "@/lib/location-pool-shippers-service";
import type { SubCustomerChannelRecord } from "@/lib/sub-customer-channel";
import { subCustomerChannelMapKey } from "@/lib/sub-customer-channel";

/** Crate types that appear on the due-today list (inbound due / export returned / owed). */
export const RETURNABLE_CRATE_TYPE_CODES = [
  "ABB",
  "WTL",
  "BHR",
  "VIO",
  "SHK",
  "BRO",
] as const;

const RETURNABLE_CRATE_TYPE_SET = new Set<string>(RETURNABLE_CRATE_TYPE_CODES);

export function isReturnableCrateTypeCode(code: string): boolean {
  return RETURNABLE_CRATE_TYPE_SET.has(code);
}

export type CrateQtyByCode = Record<string, number>;

export type CrateExportPrefillMode = "standalone" | "agent" | "pool";

export interface CrateExportPrefillMember {
  memberId: string;
  memberCode: string;
  memberName: string;
  label: string;
  /** Member inbound today by crate type (for display / live print breakdown). */
  due: CrateQtyByCode;
}

export interface CrateExportPrefillTarget {
  mode: CrateExportPrefillMode;
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  date: string;
  location: string;
  areaNote: string;
  /** Agent/pool: remaining owed today by crate type (form suggested qty). */
  owedByCode?: CrateQtyByCode;
  /** Agent shipper id (membership key); same as shipperId for named agents. */
  agentId?: string;
  members?: CrateExportPrefillMember[];
}

export function isAgentCrateExportPrefill(
  prefill: CrateExportPrefillTarget | null | undefined
): prefill is CrateExportPrefillTarget & {
  mode: "agent" | "pool";
  owedByCode: CrateQtyByCode;
  agentId: string;
  members: CrateExportPrefillMember[];
} {
  return (
    prefill != null &&
    (prefill.mode === "agent" || prefill.mode === "pool") &&
    prefill.agentId != null &&
    prefill.owedByCode != null &&
    prefill.members != null
  );
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
  /** `${parentShipperId}:${channelKey}` → resolved channel */
  subChannelsByKey: Map<string, SubCustomerChannelRecord>;
  inboundSessions: {
    shipperId: string;
    subChannelKey?: string | null;
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

function mergeMemberInboundsByMemberId<
  T extends { memberId: string; due: QtyMap },
>(members: T[]): T[] {
  const byMemberId = new Map<string, T>();
  for (const m of members) {
    const existing = byMemberId.get(m.memberId);
    if (!existing) {
      const due = emptyQty();
      for (const [code, qty] of Array.from(m.due.entries())) {
        addQty(due, code, qty);
      }
      byMemberId.set(m.memberId, { ...m, due });
      continue;
    }
    for (const [code, qty] of Array.from(m.due.entries())) {
      addQty(existing.due, code, qty);
    }
  }
  return Array.from(byMemberId.values());
}

function filterQtyMapToReturnable(map: QtyMap): QtyMap {
  const out = emptyQty();
  for (const [code, qty] of Array.from(map.entries())) {
    if (isReturnableCrateTypeCode(code)) addQty(out, code, qty);
  }
  return out;
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

function membersFromDueRows(rows: CrateExportDueRow[]): CrateExportPrefillMember[] {
  return rows.map((row) => ({
    memberId: row.prefill.shipperId,
    memberCode: row.prefill.shipperCode,
    memberName: row.prefill.shipperName,
    label: row.label,
    due: row.due,
  }));
}

function makePrefill(
  date: string,
  shipper: { id: string; code: string; name: string },
  location: string,
  areaNote = "",
  mode: CrateExportPrefillMode = "standalone"
): CrateExportPrefillTarget {
  return {
    mode,
    shipperId: shipper.id,
    shipperCode: shipper.code,
    shipperName: shipper.name,
    date,
    location,
    areaNote,
  };
}

function makeAgentPrefill(input: {
  date: string;
  mode: "agent" | "pool";
  shipper: { id: string; code: string; name: string };
  agentId: string;
  location: string;
  areaNote?: string;
  owed: CrateQtyByCode;
  members: CrateExportDueRow[];
}): CrateExportPrefillTarget {
  return {
    ...makePrefill(
      input.date,
      input.shipper,
      input.location,
      input.areaNote ?? "",
      input.mode
    ),
    owedByCode: input.owed,
    agentId: input.agentId,
    members: membersFromDueRows(input.members),
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

/** Pools first (Songkhla → Pattani), then named agents, then standalone rows — mirrors customer stock agent order. */
function dueTodayItemSortRank(item: CrateExportDueItem): number {
  if (item.kind === "pool") {
    if (item.group.poolCode === LOCATION_POOL_SHIPPER_CODES.SONGKHLA) return 0;
    if (item.group.poolCode === LOCATION_POOL_SHIPPER_CODES.PATTANI) return 1;
    return 2;
  }
  if (item.kind === "agent") return 10;
  return 100;
}

function dueTodayItemLabel(item: CrateExportDueItem): string {
  if (item.kind === "row") return item.row.label;
  if (item.kind === "agent") return item.group.agentName;
  return item.group.poolName;
}

export function sortCrateExportDueTodayItems(
  items: CrateExportDueItem[]
): CrateExportDueItem[] {
  return [...items].sort((a, b) => {
    const rankA = dueTodayItemSortRank(a);
    const rankB = dueTodayItemSortRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return dueTodayItemLabel(a).localeCompare(dueTodayItemLabel(b), undefined, {
      sensitivity: "base",
    });
  });
}

type InboundMemberDue = {
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

export type InboundDueBuckets = {
  standaloneDue: Map<string, QtyMap>;
  multiOriginDue: Map<string, { due: QtyMap; origin: string; areaNote: string }>;
  memberInbounds: InboundMemberDue[];
};

/** Aggregate inbound crate quantities by account — includes fully-returned contexts. */
export function aggregateInboundDueBuckets(
  input: BuildCrateExportDueTodayInput
): InboundDueBuckets {
  const standaloneDue = new Map<string, QtyMap>();
  const multiOriginDue = new Map<string, { due: QtyMap; origin: string; areaNote: string }>();
  const memberInbounds: InboundMemberDue[] = [];

  for (const session of input.inboundSessions) {
    const shipper = input.shippers.get(session.shipperId);
    if (!shipper) continue;

    const subChannelKey = session.subChannelKey?.trim() || "";
    const subChannel = subChannelKey
      ? input.subChannelsByKey.get(
          subCustomerChannelMapKey(session.shipperId, subChannelKey)
        )
      : undefined;

    const memberDue = emptyQty();
    for (const line of session.lines) {
      if (!line.trackInventory || line.isBox) continue;
      if (!isReturnableCrateTypeCode(line.tongCode)) continue;
      addQty(memberDue, line.tongCode, line.quantity);
    }
    if (totalOf(memberDue) === 0) continue;

    if (subChannel) {
      const memberLabel = `${shipper.name} — ${subChannel.label}`;
      if (subChannel.ownerType === "agent") {
        memberInbounds.push({
          memberId: session.shipperId,
          memberCode: shipper.code,
          memberName: memberLabel,
          agentId: subChannel.ownerShipperId,
          due: memberDue,
          location: "",
          areaNote: session.areaNote?.trim() ?? "",
          isMultiOrigin: false,
        });
        continue;
      }

      if (subChannel.ownerType === "pool") {
        const poolPickup = stockLocationForPoolShipperCode(
          subChannel.ownerShipperCode
        );
        if (!poolPickup) continue;
        memberInbounds.push({
          memberId: session.shipperId,
          memberCode: shipper.code,
          memberName: memberLabel,
          agentId: subChannel.ownerShipperId,
          poolPickup,
          due: memberDue,
          location: poolPickup,
          areaNote: session.areaNote?.trim() ?? "",
          isMultiOrigin: false,
        });
        continue;
      }

      const origin = session.customerOriginLocation?.trim() || "";
      if (subChannel.allowMultiOrigin && origin) {
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
      continue;
    }

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

    if (agent?.isPool) {
      memberInbounds.push({
        memberId: session.shipperId,
        memberCode: shipper.code,
        memberName: shipper.name,
        agentId: agentId!,
        ...(usesPool
          ? { poolPickup: effectivePickup as "SONGKHLA" | "PATTANI" }
          : {}),
        due: memberDue,
        location: usesPool ? poolAccount.location : "",
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

  return { standaloneDue, multiOriginDue, memberInbounds };
}

export function buildCrateExportDueToday(
  input: BuildCrateExportDueTodayInput
): CrateExportDueTodayData {
  const { date } = input;
  const { standaloneDue, multiOriginDue, memberInbounds } =
    aggregateInboundDueBuckets(input);

  const items: CrateExportDueItem[] = [];

  for (const [shipperId, due] of Array.from(standaloneDue.entries())) {
    const shipper = input.shippers.get(shipperId);
    if (!shipper) continue;
    const memberAgentId = input.membershipByMemberId.get(shipperId);
    const memberAgent = memberAgentId
      ? input.agents.get(memberAgentId)
      : undefined;
    if (memberAgent?.isPool) continue;
    const returned = filterQtyMapToReturnable(
      input.exportsByShipperId.get(shipperId) ?? emptyQty()
    );
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
    const returned = filterQtyMapToReturnable(
      input.exportsByShipperLocation.get(`${shipperId}|${origin}`) ?? emptyQty()
    );
    const row = buildRow(
      `multi:${shipperId}:${origin}`,
      `${shipper.name} — ${origin}`,
      due,
      returned,
      makePrefill(date, { id: shipperId, ...shipper }, origin, areaNote)
    );
    if (row) items.push({ kind: "row", row });
  }

  const membersByAgent = new Map<string, InboundMemberDue[]>();
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
      const poolReturned = filterQtyMapToReturnable(
        input.exportsByShipperId.get(poolShipperId) ?? emptyQty()
      );

      const memberRows: CrateExportDueRow[] = [];
      const memberDueMaps: QtyMap[] = [];

      for (const m of mergeMemberInboundsByMemberId(members)) {
        const returned = filterQtyMapToReturnable(
          input.exportsByShipperId.get(m.memberId) ?? emptyQty()
        );
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
            prefill: makeAgentPrefill({
              date,
              mode: "pool",
              shipper: {
                id: poolShipperId,
                code: agent.code,
                name: agent.name,
              },
              agentId,
              location: agent.pickup,
              owed: qtyMapToRecord(owed),
              members: memberRows,
            }),
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
      let returned = filterQtyMapToReturnable(
        input.exportsByShipperId.get(m.memberId) ?? emptyQty()
      );
      if (m.isMultiOrigin && m.origin) {
        returned = filterQtyMapToReturnable(
          input.exportsByShipperLocation.get(`${m.memberId}|${m.origin}`) ??
            input.exportsByShipperId.get(m.memberId) ??
            emptyQty()
        );
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

    const agentReturned = filterQtyMapToReturnable(
      input.exportsByShipperId.get(agentId) ?? emptyQty()
    );
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
          prefill: makeAgentPrefill({
            date,
            mode: "agent",
            shipper: { id: agentId, code: agent.code, name: agent.name },
            agentId,
            location: "",
            owed: qtyMapToRecord(owed),
            members: memberRows,
          }),
          members: memberRows.sort((a, b) => a.label.localeCompare(b.label)),
        },
      });
    }
  }

  const sortedItems = sortCrateExportDueTodayItems(items);

  return { date, items: sortedItems, inTransitNote: null };
}

export { formatQtySummary };
