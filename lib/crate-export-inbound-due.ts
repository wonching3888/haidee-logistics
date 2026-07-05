import type {
  BuildCrateExportDueTodayInput,
  CrateExportDueItem,
  CrateQtyByCode,
} from "@/lib/crate-export-due-today";
import {
  aggregateInboundDueBuckets,
  qtyMapToRecord,
} from "@/lib/crate-export-due-today";

/** Inbound due totals by shipper / location (same keys as live-owed index). */
export interface InboundDueIndex {
  standalone: Map<string, CrateQtyByCode>;
  byShipperLocation: Map<string, CrateQtyByCode>;
  byAgentShipperId: Map<string, CrateQtyByCode>;
}

function mergeQtyRecords(...records: CrateQtyByCode[]): CrateQtyByCode {
  const out: CrateQtyByCode = {};
  for (const rec of records) {
    for (const [code, qty] of Object.entries(rec)) {
      if (qty > 0) out[code] = (out[code] ?? 0) + qty;
    }
  }
  return out;
}

/** Full inbound totals for the day — includes fully-returned contexts. */
export function buildInboundDueIndexFromDayInput(
  input: BuildCrateExportDueTodayInput
): InboundDueIndex {
  const { standaloneDue, multiOriginDue, memberInbounds } =
    aggregateInboundDueBuckets(input);
  const index: InboundDueIndex = {
    standalone: new Map(),
    byShipperLocation: new Map(),
    byAgentShipperId: new Map(),
  };

  for (const [shipperId, due] of Array.from(standaloneDue.entries())) {
    index.standalone.set(shipperId, qtyMapToRecord(due));
  }
  for (const [key, { due }] of Array.from(multiOriginDue.entries())) {
    index.byShipperLocation.set(key, qtyMapToRecord(due));
  }
  for (const m of memberInbounds) {
    if (m.isMultiOrigin && m.origin) {
      const k = `${m.memberId}|${m.origin}`;
      const cur = index.byShipperLocation.get(k) ?? {};
      index.byShipperLocation.set(
        k,
        mergeQtyRecords(cur, qtyMapToRecord(m.due))
      );
      continue;
    }

    if (!input.membershipByMemberId.has(m.memberId)) {
      continue;
    }

    const cur = index.standalone.get(m.memberId) ?? {};
    index.standalone.set(
      m.memberId,
      mergeQtyRecords(cur, qtyMapToRecord(m.due))
    );
  }

  const membersByAgent = new Map<string, typeof memberInbounds>();
  for (const m of memberInbounds) {
    const list = membersByAgent.get(m.agentId) ?? [];
    list.push(m);
    membersByAgent.set(m.agentId, list);
  }

  for (const [agentId, members] of membersByAgent) {
    const agent = input.agents.get(agentId);
    if (!agent) continue;

    const dueByMember = new Map<string, CrateQtyByCode>();
    for (const m of members) {
      const cur = dueByMember.get(m.memberId) ?? {};
      dueByMember.set(
        m.memberId,
        mergeQtyRecords(cur, qtyMapToRecord(m.due))
      );
    }
    const totalDue = mergeQtyRecords(...dueByMember.values());
    index.byAgentShipperId.set(agentId, totalDue);
    if (agent.isPool && agent.pickup) {
      const poolShipperId = input.poolIds[agent.pickup];
      index.byAgentShipperId.set(poolShipperId, totalDue);
    }
  }

  return index;
}

export function buildInboundDueIndexFromDueToday(
  items: CrateExportDueItem[]
): InboundDueIndex {
  const index: InboundDueIndex = {
    standalone: new Map(),
    byShipperLocation: new Map(),
    byAgentShipperId: new Map(),
  };

  for (const item of items) {
    if (item.kind === "row") {
      const { shipperId, location } = item.row.prefill;
      if (location) {
        index.byShipperLocation.set(`${shipperId}|${location}`, item.row.due);
      } else {
        index.standalone.set(shipperId, item.row.due);
      }
      continue;
    }

    if (item.kind === "agent") {
      index.byAgentShipperId.set(item.group.agentId, item.group.due);
      continue;
    }

    index.byAgentShipperId.set(item.group.poolShipperId, item.group.due);
  }

  return index;
}

export function lookupInboundDue(
  index: InboundDueIndex,
  params: {
    shipperId: string;
    location?: string;
    isAgentReceipt?: boolean;
  }
): CrateQtyByCode {
  if (params.isAgentReceipt) {
    return index.byAgentShipperId.get(params.shipperId) ?? {};
  }

  const location = params.location?.trim() ?? "";
  if (location) {
    const locDue = index.byShipperLocation.get(`${params.shipperId}|${location}`);
    if (locDue && Object.keys(locDue).length > 0) {
      return locDue;
    }
    return index.standalone.get(params.shipperId) ?? {};
  }

  return index.standalone.get(params.shipperId) ?? {};
}
