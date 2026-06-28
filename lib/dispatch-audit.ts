import type { Prisma } from "@prisma/client";
import { formatDisplayDate, toDateInputValue } from "@/lib/date-utils";

export type DispatchAuditEntityType = "dispatch" | "charter";

export type DispatchAuditEventType =
  | "create"
  | "update"
  | "cancel"
  | "delete"
  | "truck_change"
  | "driver_change"
  | "status_change";

export interface DispatchCargoLine {
  inboundLineId: string;
  stallLabel: string;
  qty: number;
}

export interface DispatchCargoDiffSummary {
  added: Array<{ stallLabel: string; qty: number }>;
  removed: Array<{ stallLabel: string; qty: number }>;
  qtyChanged: Array<{ stallLabel: string; from: number; to: number }>;
}

export interface CharterLineSnapshot {
  tongTypeId: string;
  tongTypeCode: string;
  quantity: number;
}

export interface CharterLineDiffSummary {
  added: Array<{ code: string; qty: number }>;
  removed: Array<{ code: string; qty: number }>;
  qtyChanged: Array<{ code: string; from: number; to: number }>;
}

export interface CharterExtraSnapshot {
  itemType: string;
  amountMyr: number;
  note: string | null;
}

export interface DispatchFieldChange {
  field: string;
  fromValue: string | null;
  toValue: string | null;
}

export interface DispatchChangeLogInput {
  entityType: DispatchAuditEntityType;
  entityId: string;
  entityLabel?: string | null;
  eventType: DispatchAuditEventType;
  field?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export const DISPATCH_FIELD_LABELS: Record<string, string> = {
  date: "日期 Date",
  plate: "车牌 Plate",
  driverName: "司机 Driver",
  markets: "市场 Markets",
  status: "状态 Status",
  cargo: "货行 Cargo",
  charterRevenueMyr: "顾客总价 Revenue",
  charterDriverSalaryMyr: "司机工钱 Driver salary",
  billingCompany: "开票主体 Billing",
  cargoType: "货类 Cargo type",
  totalQuantity: "总桶数 Total qty",
  lines: "桶型明细 Lines",
  extraItems: "额外费用 Extra items",
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatAuditMoney(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const num = (value as { toNumber(): number }).toNumber();
    if (!Number.isFinite(num)) return null;
    return roundMoney(num).toFixed(2);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return roundMoney(value).toFixed(2);
  }
  return String(value);
}

export function formatStallLabel(stall: {
  code: string;
  market?: { code: string } | null;
}): string {
  const market = stall.market?.code ?? "";
  return market ? `${market}/${stall.code}` : stall.code;
}

export function formatMarketsAudit(markets: string[] | null | undefined): string {
  return [...(markets ?? [])].sort().join(", ");
}

export function diffDispatchCargo(
  before: DispatchCargoLine[],
  after: DispatchCargoLine[]
): DispatchCargoDiffSummary | null {
  const beforeMap = new Map(before.map((line) => [line.inboundLineId, line]));
  const afterMap = new Map(after.map((line) => [line.inboundLineId, line]));

  const added: DispatchCargoDiffSummary["added"] = [];
  const removed: DispatchCargoDiffSummary["removed"] = [];
  const qtyChanged: DispatchCargoDiffSummary["qtyChanged"] = [];

  for (const [id, line] of Array.from(afterMap.entries())) {
    const prev = beforeMap.get(id);
    if (!prev) {
      added.push({ stallLabel: line.stallLabel, qty: line.qty });
      continue;
    }
    if (prev.qty !== line.qty) {
      qtyChanged.push({
        stallLabel: line.stallLabel,
        from: prev.qty,
        to: line.qty,
      });
    }
  }

  for (const [id, line] of Array.from(beforeMap.entries())) {
    if (!afterMap.has(id)) {
      removed.push({ stallLabel: line.stallLabel, qty: line.qty });
    }
  }

  if (added.length === 0 && removed.length === 0 && qtyChanged.length === 0) {
    return null;
  }

  return { added, removed, qtyChanged };
}

export function summarizeDispatchCargoDiff(
  diff: DispatchCargoDiffSummary | null
): { from: string; to: string } | null {
  if (!diff) return null;
  const fromParts: string[] = [];
  const toParts: string[] = [];

  if (diff.removed.length > 0) {
    fromParts.push(
      `移除 ${diff.removed.length} 行: ${diff.removed
        .slice(0, 3)
        .map((row) => `${row.stallLabel}×${row.qty}`)
        .join("; ")}${diff.removed.length > 3 ? "…" : ""}`
    );
  }
  if (diff.added.length > 0) {
    toParts.push(
      `新增 ${diff.added.length} 行: ${diff.added
        .slice(0, 3)
        .map((row) => `${row.stallLabel}×${row.qty}`)
        .join("; ")}${diff.added.length > 3 ? "…" : ""}`
    );
  }
  if (diff.qtyChanged.length > 0) {
    const text = diff.qtyChanged
      .slice(0, 3)
      .map((row) => `${row.stallLabel} ${row.from}→${row.to}`)
      .join("; ");
    fromParts.push(`改量 ${diff.qtyChanged.length} 行`);
    toParts.push(`${text}${diff.qtyChanged.length > 3 ? "…" : ""}`);
  }

  return {
    from: fromParts.join(" · ") || "—",
    to: toParts.join(" · ") || "—",
  };
}

export function diffCharterLines(
  before: CharterLineSnapshot[],
  after: CharterLineSnapshot[]
): CharterLineDiffSummary | null {
  const key = (line: CharterLineSnapshot) => line.tongTypeId;
  const beforeMap = new Map(before.map((line) => [key(line), line]));
  const afterMap = new Map(after.map((line) => [key(line), line]));

  const added: CharterLineDiffSummary["added"] = [];
  const removed: CharterLineDiffSummary["removed"] = [];
  const qtyChanged: CharterLineDiffSummary["qtyChanged"] = [];

  for (const [id, line] of Array.from(afterMap.entries())) {
    const prev = beforeMap.get(id);
    if (!prev) {
      added.push({ code: line.tongTypeCode, qty: line.quantity });
      continue;
    }
    if (prev.quantity !== line.quantity) {
      qtyChanged.push({
        code: line.tongTypeCode,
        from: prev.quantity,
        to: line.quantity,
      });
    }
  }

  for (const [id, line] of Array.from(beforeMap.entries())) {
    if (!afterMap.has(id)) {
      removed.push({ code: line.tongTypeCode, qty: line.quantity });
    }
  }

  if (added.length === 0 && removed.length === 0 && qtyChanged.length === 0) {
    return null;
  }

  return { added, removed, qtyChanged };
}

export function diffDispatchScalarFields(
  before: Record<string, string | null | undefined>,
  after: Record<string, string | null | undefined>,
  fields: string[]
): DispatchFieldChange[] {
  const changes: DispatchFieldChange[] = [];
  for (const field of fields) {
    const fromValue = before[field] ?? null;
    const toValue = after[field] ?? null;
    if (fromValue === toValue) continue;
    changes.push({ field, fromValue, toValue });
  }
  return changes;
}

export function buildDispatchCreateMetadata(input: {
  dispatchNo: string | null;
  date: Date;
  plate: string;
  driverName: string | null;
  markets: string[];
  lineCount: number;
  totalQty: number;
}) {
  return {
    dispatchNo: input.dispatchNo,
    date: toDateInputValue(input.date),
    plate: input.plate,
    driverName: input.driverName,
    markets: input.markets,
    lineCount: input.lineCount,
    totalQty: input.totalQty,
  };
}

export function buildCharterCreateMetadata(input: {
  charterNo: string | null;
  date: Date;
  plate: string;
  driverName: string | null;
  cargoType: string;
  charterRevenueMyr: unknown;
  lineCount: number;
  totalQty: number;
}) {
  return {
    charterNo: input.charterNo,
    date: toDateInputValue(input.date),
    plate: input.plate,
    driverName: input.driverName,
    cargoType: input.cargoType,
    charterRevenueMyr: formatAuditMoney(input.charterRevenueMyr),
    lineCount: input.lineCount,
    totalQty: input.totalQty,
  };
}

export function formatDateAudit(date: Date): string {
  return formatDisplayDate(date);
}

export async function loadDispatchCargoLines(
  client: Prisma.TransactionClient | { inboundLine: Prisma.TransactionClient["inboundLine"] },
  inboundLineIds: string[]
): Promise<DispatchCargoLine[]> {
  if (inboundLineIds.length === 0) return [];

  const lines = await client.inboundLine.findMany({
    where: { id: { in: inboundLineIds } },
    select: {
      id: true,
      quantity: true,
      stall: { select: { code: true, market: { select: { code: true } } } },
    },
    orderBy: { id: "asc" },
  });

  return lines.map((line) => ({
    inboundLineId: line.id,
    stallLabel: formatStallLabel(line.stall),
    qty: line.quantity,
  }));
}

export function totalCargoQty(lines: DispatchCargoLine[]) {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

export async function appendDispatchChangeLogs(
  tx: Prisma.TransactionClient,
  input: {
    actorUserId: string;
    logs: DispatchChangeLogInput[];
  }
) {
  if (input.logs.length === 0) return;

  await tx.dispatchChangeLog.createMany({
    data: input.logs.map((log) => ({
      entityType: log.entityType,
      entityId: log.entityId,
      entityLabel: log.entityLabel ?? null,
      eventType: log.eventType,
      field: log.field ?? null,
      fromValue: log.fromValue ?? null,
      toValue: log.toValue ?? null,
      metadata: log.metadata ?? undefined,
      changedBy: input.actorUserId,
    })),
  });
}

export function dispatchAuditFieldLabel(field: string): string {
  return DISPATCH_FIELD_LABELS[field] ?? field;
}

export function dispatchAuditEventLabel(
  entityType: DispatchAuditEntityType,
  eventType: string
): string {
  const prefix = entityType === "charter" ? "包车" : "派车";
  switch (eventType) {
    case "create":
      return `${prefix}新建`;
    case "update":
      return `${prefix}编辑`;
    case "cancel":
      return "派车取消";
    case "delete":
      return "包车删除";
    case "truck_change":
      return "换车";
    case "driver_change":
      return "换司机";
    case "status_change":
      return "状态变更";
    default:
      return eventType;
  }
}

export function buildDispatchUpdateLogs(input: {
  entityId: string;
  entityLabel: string | null;
  fieldChanges: DispatchFieldChange[];
  cargoDiff: DispatchCargoDiffSummary | null;
}): DispatchChangeLogInput[] {
  const logs: DispatchChangeLogInput[] = input.fieldChanges.map((change) => ({
    entityType: "dispatch",
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    eventType: "update",
    field: change.field,
    fromValue: change.fromValue,
    toValue: change.toValue,
  }));

  if (input.cargoDiff) {
    const summary = summarizeDispatchCargoDiff(input.cargoDiff);
    logs.push({
      entityType: "dispatch",
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      eventType: "update",
      field: "cargo",
      fromValue: summary?.from ?? null,
      toValue: summary?.to ?? null,
      metadata: { cargo: input.cargoDiff } as unknown as Prisma.InputJsonValue,
    });
  }

  return logs;
}
