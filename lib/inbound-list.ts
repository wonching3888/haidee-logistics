import {
  getDefaultInboundDate,
  resolveDateParam,
  toDateInputValue,
} from "@/lib/inbound-utils";

/** URL sentinel when the user clears the date filter (recent sessions, not all history). */
export const INBOUND_LIST_ALL_DATES = "all" as const;

/** Hard cap on inbound list rows returned from the database. */
export const INBOUND_SESSIONS_LIST_LIMIT = 300;

/** Resolve list query date: default = inbound business date; `all` = no date filter. */
export function resolveInboundListQueryDate(dateParam?: string): string | undefined {
  if (!dateParam) {
    return toDateInputValue(getDefaultInboundDate());
  }
  if (dateParam === INBOUND_LIST_ALL_DATES) {
    return undefined;
  }
  return resolveDateParam(dateParam);
}

/** Date filter field display: default shows business today; `all` shows empty. */
export function resolveInboundListDateFieldValue(dateParam: string | null): string {
  if (dateParam === INBOUND_LIST_ALL_DATES) return "";
  if (dateParam) return resolveDateParam(dateParam);
  return toDateInputValue(getDefaultInboundDate());
}

export interface InboundSessionListRow {
  id: string;
  sessionNo: string | null;
  date: string;
  status: string;
  shipperName: string;
  areaNote: string | null;
  pickupLocationLabel: string;
  thVehiclePlate: string | null;
  totalQty: number;
  crateQty: number;
  boxQty: number;
  unassignedQty: number;
  unassignedCrateQty: number;
  unassignedBoxQty: number;
}

export interface InboundSessionListSource {
  id: string;
  sessionNo: string | null;
  date: Date;
  status: string;
  shipperName: string;
  areaNote: string | null;
  pickupLocationLabel: string;
  thVehiclePlate: string | null;
  totalQty: number;
  crateQty: number;
  boxQty: number;
  unassignedQty: number;
  unassignedCrateQty: number;
  unassignedBoxQty: number;
}

/** Plain JSON-safe rows for the inbound list table (no Date / extra fields). */
export function serializeInboundSessionListRows(
  sessions: InboundSessionListSource[]
): InboundSessionListRow[] {
  return sessions.map((session) => ({
    id: session.id,
    sessionNo: session.sessionNo,
    date: toDateInputValue(new Date(session.date)),
    status: session.status,
    shipperName: session.shipperName ?? "",
    areaNote: session.areaNote,
    pickupLocationLabel: session.pickupLocationLabel,
    thVehiclePlate: session.thVehiclePlate,
    totalQty: Number(session.totalQty) || 0,
    crateQty: Number(session.crateQty) || 0,
    boxQty: Number(session.boxQty) || 0,
    unassignedQty: Number(session.unassignedQty) || 0,
    unassignedCrateQty: Number(session.unassignedCrateQty) || 0,
    unassignedBoxQty: Number(session.unassignedBoxQty) || 0,
  }));
}
