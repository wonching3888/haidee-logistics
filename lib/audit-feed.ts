import type { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/inbound-utils";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/date-utils";
import {
  formatPickupLocationLabel,
  resolveSessionPickupLocation,
} from "@/lib/constants/pickup-locations";
import { PAYROLL_EXTRA_TYPES } from "@/lib/constants/payroll";
import {
  payrollAuditEventLabel,
  payrollAuditFieldLabel,
} from "@/lib/payroll-audit";
import { voucherAuditFieldLabel } from "@/lib/driver-voucher-audit";
import {
  dispatchAuditEventLabel,
  dispatchAuditFieldLabel,
} from "@/lib/dispatch-audit";
import {
  invoiceCollectionsDeepLink,
  invoicePaymentAuditEventLabel,
  invoicePaymentAuditFieldLabel,
} from "@/lib/invoice-payment-audit";

export type AuditEntityType =
  | "inbound"
  | "voucher"
  | "payroll"
  | "dispatch"
  | "charter"
  | "invoice_payment";

export interface AuditFeedChange {
  field: string;
  from: string;
  to: string;
}

export interface AuditFeedEntry {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  eventType: string;
  eventTypeLabel: string;
  occurredAt: Date;
  occurredAtDisplay: string;
  actorName: string;
  changes: AuditFeedChange[];
  deepLink?: string;
  sessionNo?: string | null;
  sessionDate?: string;
  shipperName?: string;
  pickupLocationLabel?: string;
}

export type HistoryTab =
  | "all"
  | "inbound"
  | "payroll"
  | "voucher"
  | "trips"
  | "invoice_collections";

const ALL_ENTITY_TYPES: AuditEntityType[] = [
  "inbound",
  "voucher",
  "payroll",
  "dispatch",
  "charter",
  "invoice_payment",
];

export function resolveHistoryEntityTypes(tab?: string): AuditEntityType[] {
  switch (tab) {
    case "inbound":
      return ["inbound"];
    case "payroll":
      return ["payroll"];
    case "voucher":
      return ["voucher"];
    case "trips":
      return ["dispatch", "charter"];
    case "invoice_collections":
      return ["invoice_payment"];
    default:
      return ALL_ENTITY_TYPES;
  }
}

function changedAtDayRange(dateStr: string) {
  const start = parseDateInput(dateStr);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

function groupTimestampKey(at: Date) {
  return format(at, "yyyy-MM-dd HH:mm:ss");
}

function extraTypeLabel(type: string) {
  return PAYROLL_EXTRA_TYPES.find((item) => item.value === type)?.label ?? type;
}

function parsePayrollMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function payrollDeepLink(input: {
  driverId?: unknown;
  yearMonth?: unknown;
}) {
  const yearMonth = typeof input.yearMonth === "string" ? input.yearMonth : "";
  const [year, month] = yearMonth.split("-");
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (month) params.set("month", String(Number(month)));
  if (typeof input.driverId === "string" && input.driverId) {
    params.set("driverId", input.driverId);
  }
  const query = params.toString();
  return query ? `/driver-payroll?${query}` : "/driver-payroll";
}

async function loadActorNames(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map<string, string>();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });

  return new Map(
    users.map((user) => [user.id, user.name?.trim() || user.email || "—"])
  );
}

async function fetchInboundAuditEntries(
  dateStr?: string
): Promise<AuditFeedEntry[]> {
  const sessionDateWhere = dateStr ? { date: parseDateInput(dateStr) } : undefined;
  const logDateWhere = dateStr ? { createdAt: changedAtDayRange(dateStr) } : undefined;

  const changeLogs = await prisma.inboundChangeLog.findMany({
    where: {
      ...(logDateWhere ?? {}),
      ...(sessionDateWhere ? { session: sessionDateWhere } : {}),
    },
    include: {
      session: {
        select: {
          id: true,
          sessionNo: true,
          date: true,
          pickupLocation: true,
          shipper: { select: { name: true, pickupLocation: true } },
        },
      },
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const grouped = new Map<string, AuditFeedEntry>();
  for (const log of changeLogs) {
    const key = `${log.sessionId}:${log.userId ?? "unknown"}:${groupTimestampKey(log.createdAt)}`;
    const change: AuditFeedChange = {
      field: log.field,
      from: log.fromValue,
      to: log.toValue,
    };
    const actorName =
      log.user?.name?.trim() || log.user?.email?.trim() || "—";
    const pickupLocationLabel = formatPickupLocationLabel(
      resolveSessionPickupLocation(
        log.session.pickupLocation,
        log.session.shipper.pickupLocation
      )
    );
    const entityLabel = [
      log.session.sessionNo ?? "进货",
      log.session.shipper.name,
      pickupLocationLabel,
    ]
      .filter(Boolean)
      .join(" · ");

    const existing = grouped.get(key);
    if (existing) {
      existing.changes.push(change);
      continue;
    }

    grouped.set(key, {
      id: log.id,
      entityType: "inbound",
      entityId: log.sessionId,
      entityLabel,
      eventType: "field_change",
      eventTypeLabel: "进货修改",
      occurredAt: log.createdAt,
      occurredAtDisplay: formatDisplayDateTime(log.createdAt),
      actorName,
      changes: [change],
      deepLink: log.session.sessionNo
        ? `/inbound?sessionNo=${encodeURIComponent(log.session.sessionNo)}`
        : "/inbound",
      sessionNo: log.session.sessionNo,
      sessionDate: formatDisplayDate(log.session.date),
      shipperName: log.session.shipper.name,
      pickupLocationLabel,
    });
  }

  const sessionsWithChangeLogs = new Set(changeLogs.map((log) => log.sessionId));
  const legacyWhere: Prisma.InboundLineWhereInput = {
    originalQuantity: { not: null },
    sessionId: { notIn: Array.from(sessionsWithChangeLogs) },
  };
  if (sessionDateWhere) {
    legacyWhere.session = sessionDateWhere;
  }

  const legacyLines = await prisma.inboundLine.findMany({
    where: legacyWhere,
    include: {
      session: {
        select: {
          id: true,
          sessionNo: true,
          date: true,
          pickupLocation: true,
          shipper: { select: { name: true, pickupLocation: true } },
        },
      },
      stall: { include: { market: true } },
      tongType: true,
      originalTongType: true,
      originalStall: { include: { market: true } },
    },
    orderBy: [{ modifiedAt: "desc" }, { createdAt: "desc" }],
  });

  const legacyEntries: AuditFeedEntry[] = legacyLines.flatMap((line) => {
    const changes = buildLegacyInboundChanges(line);
    if (changes.length === 0) return [];

    const pickupLocationLabel = formatPickupLocationLabel(
      resolveSessionPickupLocation(
        line.session.pickupLocation,
        line.session.shipper.pickupLocation
      )
    );
    const occurredAt = line.modifiedAt ?? line.session.date;
    const entityLabel = [
      line.session.sessionNo ?? "进货",
      line.session.shipper.name,
      pickupLocationLabel,
    ]
      .filter(Boolean)
      .join(" · ");

    return [
      {
        id: line.id,
        entityType: "inbound" as const,
        entityId: line.session.id,
        entityLabel,
        eventType: "legacy_line",
        eventTypeLabel: "进货修改",
        occurredAt,
        occurredAtDisplay: line.modifiedAt
          ? formatDisplayDateTime(line.modifiedAt)
          : "—",
        actorName: "—",
        changes,
        deepLink: line.session.sessionNo
          ? `/inbound?sessionNo=${encodeURIComponent(line.session.sessionNo)}`
          : "/inbound",
        sessionNo: line.session.sessionNo,
        sessionDate: formatDisplayDate(line.session.date),
        shipperName: line.session.shipper.name,
        pickupLocationLabel,
      },
    ];
  });

  return [...Array.from(grouped.values()), ...legacyEntries];
}

function buildLegacyInboundChanges(line: {
  originalQuantity: number | null;
  quantity: number;
  originalTongType: { code: string; name: string } | null;
  tongType: { code: string; name: string };
  originalStall: { code: string; market: { code: string } | null } | null;
  stall: { code: string; market: { code: string } | null };
}) {
  const changes: AuditFeedChange[] = [];

  if (
    line.originalQuantity !== null &&
    line.originalQuantity !== line.quantity
  ) {
    changes.push({
      field: "桶数 Crates",
      from: String(line.originalQuantity),
      to: String(line.quantity),
    });
  }

  if (
    line.originalTongType &&
    line.originalTongType.code !== line.tongType.code
  ) {
    changes.push({
      field: "桶型 Crate Type",
      from: `${line.originalTongType.code} (${line.originalTongType.name})`,
      to: `${line.tongType.code} (${line.tongType.name})`,
    });
  }

  if (line.originalStall) {
    const origMarket = line.originalStall.market?.code ?? "";
    const newMarket = line.stall.market?.code ?? "";
    const origLabel = origMarket
      ? `${origMarket}/${line.originalStall.code}`
      : line.originalStall.code;
    const newLabel = newMarket
      ? `${newMarket}/${line.stall.code}`
      : line.stall.code;

    if (origLabel !== newLabel) {
      changes.push({
        field: "收货人 Receiver",
        from: origLabel,
        to: newLabel,
      });
    }
  }

  return changes;
}

async function fetchVoucherAuditEntries(
  dateStr?: string
): Promise<AuditFeedEntry[]> {
  const changedAtWhere = dateStr ? changedAtDayRange(dateStr) : undefined;

  const logs = await prisma.driverVoucherChangeLog.findMany({
    where: changedAtWhere ? { changedAt: changedAtWhere } : {},
    include: {
      voucher: {
        select: {
          id: true,
          voucherNo: true,
          driverName: true,
          route: true,
          tripDate: true,
        },
      },
    },
    orderBy: { changedAt: "desc" },
  });

  const actorNames = await loadActorNames(
    logs.map((log) => log.changedBy).filter((id): id is string => Boolean(id))
  );

  const grouped = new Map<string, AuditFeedEntry>();
  for (const log of logs) {
    const key = `${log.voucherId}:${log.changedBy ?? "unknown"}:${groupTimestampKey(log.changedAt)}:${log.eventType}`;
    const fieldLabel =
      log.field != null ? voucherAuditFieldLabel(log.field) : log.eventType;
    const change: AuditFeedChange = {
      field: fieldLabel,
      from: log.oldValue ?? "—",
      to: log.newValue ?? "—",
    };
    const entityLabel = [
      log.voucher.voucherNo,
      log.voucher.driverName,
      log.voucher.route,
    ]
      .filter(Boolean)
      .join(" · ");

    const existing = grouped.get(key);
    if (existing) {
      existing.changes.push(change);
      continue;
    }

    grouped.set(key, {
      id: log.id,
      entityType: "voucher",
      entityId: log.voucherId,
      entityLabel,
      eventType: log.eventType,
      eventTypeLabel:
        log.eventType === "field_change" ? "费用单修改" : log.eventType,
      occurredAt: log.changedAt,
      occurredAtDisplay: formatDisplayDateTime(log.changedAt),
      actorName: log.changedBy
        ? (actorNames.get(log.changedBy) ?? "—")
        : "—",
      changes: [change],
      deepLink: `/documents/driver-expenses/${log.voucherId}`,
    });
  }

  return Array.from(grouped.values());
}

async function fetchPayrollAuditEntries(
  dateStr?: string
): Promise<AuditFeedEntry[]> {
  const changedAtWhere = dateStr ? changedAtDayRange(dateStr) : undefined;

  const logs = await prisma.payrollChangeLog.findMany({
    where: changedAtWhere ? { changedAt: changedAtWhere } : {},
    orderBy: { changedAt: "desc" },
  });

  const actorNames = await loadActorNames(logs.map((log) => log.changedBy));

  const grouped = new Map<string, AuditFeedEntry>();
  for (const log of logs) {
    const key = `${log.payrollMonthId ?? ""}:${log.payrollTripId ?? ""}:${log.payrollExtraId ?? ""}:${log.changedBy}:${groupTimestampKey(log.changedAt)}:${log.eventType}`;
    const metadata = parsePayrollMetadata(log.metadata);
    const driverName =
      typeof metadata.driverName === "string" ? metadata.driverName : "司机";
    const tripNo =
      typeof metadata.tripNo === "string" && metadata.tripNo
        ? metadata.tripNo
        : null;
    const entityLabel = [driverName, log.yearMonth, tripNo]
      .filter(Boolean)
      .join(" · ");

    let change: AuditFeedChange;
    if (log.eventType === "extra_create" || log.eventType === "extra_delete") {
      const type =
        typeof metadata.type === "string"
          ? extraTypeLabel(metadata.type)
          : "借支/额外";
      const amount =
        metadata.amount != null ? String(metadata.amount) : "—";
      const date =
        typeof metadata.date === "string" ? metadata.date : "—";
      const note =
        typeof metadata.note === "string" && metadata.note
          ? ` (${metadata.note})`
          : "";
      change = {
        field: type,
        from: log.eventType === "extra_delete" ? `${amount} · ${date}${note}` : "—",
        to: log.eventType === "extra_create" ? `${amount} · ${date}${note}` : "—",
      };
    } else {
      change = {
        field: log.field ? payrollAuditFieldLabel(log.field) : log.eventType,
        from: log.fromValue ?? "—",
        to: log.toValue ?? "—",
      };
    }

    const existing = grouped.get(key);
    if (existing) {
      existing.changes.push(change);
      continue;
    }

    grouped.set(key, {
      id: log.id,
      entityType: "payroll",
      entityId: log.payrollMonthId ?? log.id,
      entityLabel,
      eventType: log.eventType,
      eventTypeLabel: payrollAuditEventLabel(log.eventType),
      occurredAt: log.changedAt,
      occurredAtDisplay: formatDisplayDateTime(log.changedAt),
      actorName: actorNames.get(log.changedBy) ?? "—",
      changes: [change],
      deepLink: payrollDeepLink({
        driverId: log.driverId,
        yearMonth: log.yearMonth,
      }),
    });
  }

  return Array.from(grouped.values());
}

function parseDispatchMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function dispatchDeepLink(entityType: "dispatch" | "charter", entityId: string) {
  return entityType === "charter" ? `/charter/${entityId}` : `/dispatch/${entityId}`;
}

function buildDispatchFeedChange(log: {
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  eventType: string;
  metadata: unknown;
}): AuditFeedChange {
  const metadata = parseDispatchMetadata(log.metadata);

  if (log.field) {
    return {
      field: dispatchAuditFieldLabel(log.field),
      from: log.fromValue ?? "—",
      to: log.toValue ?? "—",
    };
  }

  if (log.eventType === "create") {
    const parts = [
      metadata.dispatchNo,
      metadata.charterNo,
      metadata.plate,
      metadata.driverName,
      metadata.lineCount != null ? `${metadata.lineCount} 行` : null,
    ].filter(Boolean);
    return {
      field: "新建",
      from: "—",
      to: parts.map(String).join(" · ") || "—",
    };
  }

  if (log.eventType === "delete") {
    const parts = [
      metadata.charterNo,
      metadata.plate,
      metadata.cargoType,
    ].filter(Boolean);
    return {
      field: "删除快照",
      from: parts.map(String).join(" · ") || "—",
      to: "—",
    };
  }

  if (log.eventType === "cancel") {
    return {
      field: "取消",
      from: log.fromValue ?? "—",
      to: log.toValue ?? "—",
    };
  }

  return {
    field: log.eventType,
    from: log.fromValue ?? "—",
    to: log.toValue ?? "—",
  };
}

async function fetchDispatchAuditEntries(
  dateStr?: string
): Promise<AuditFeedEntry[]> {
  const changedAtWhere = dateStr ? changedAtDayRange(dateStr) : undefined;

  const logs = await prisma.dispatchChangeLog.findMany({
    where: changedAtWhere ? { changedAt: changedAtWhere } : {},
    orderBy: { changedAt: "desc" },
  });

  const actorNames = await loadActorNames(logs.map((log) => log.changedBy));

  const grouped = new Map<string, AuditFeedEntry>();
  for (const log of logs) {
    const entityType = log.entityType as "dispatch" | "charter";
    const key = `${log.entityType}:${log.entityId}:${log.changedBy}:${groupTimestampKey(log.changedAt)}:${log.eventType}`;
    const change = buildDispatchFeedChange(log);
    const entityLabel =
      log.entityLabel ??
      (typeof parseDispatchMetadata(log.metadata).dispatchNo === "string"
        ? String(parseDispatchMetadata(log.metadata).dispatchNo)
        : typeof parseDispatchMetadata(log.metadata).charterNo === "string"
          ? String(parseDispatchMetadata(log.metadata).charterNo)
          : log.entityId);

    const existing = grouped.get(key);
    if (existing) {
      existing.changes.push(change);
      continue;
    }

    grouped.set(key, {
      id: log.id,
      entityType,
      entityId: log.entityId,
      entityLabel,
      eventType: log.eventType,
      eventTypeLabel: dispatchAuditEventLabel(entityType, log.eventType),
      occurredAt: log.changedAt,
      occurredAtDisplay: formatDisplayDateTime(log.changedAt),
      actorName: actorNames.get(log.changedBy) ?? "—",
      changes: [change],
      deepLink: dispatchDeepLink(entityType, log.entityId),
    });
  }

  return Array.from(grouped.values());
}

function parseInvoicePaymentMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function buildInvoicePaymentFeedChange(log: {
  eventType: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  metadata: unknown;
}): AuditFeedChange {
  const metadata = parseInvoicePaymentMetadata(log.metadata);

  if (log.eventType === "create") {
    const amount =
      metadata.amount != null ? String(metadata.amount) : "—";
    const currency =
      typeof metadata.currency === "string" ? metadata.currency : "";
    const bankAccount =
      typeof metadata.bankAccount === "string" ? metadata.bankAccount : "—";
    const paymentDate =
      typeof metadata.paymentDate === "string" ? metadata.paymentDate : "—";
    return {
      field: "录款",
      from: "—",
      to: `${amount} ${currency} · ${bankAccount} · ${paymentDate}`,
    };
  }

  if (log.eventType === "delete") {
    const amount =
      metadata.amount != null ? String(metadata.amount) : "—";
    const currency =
      typeof metadata.currency === "string" ? metadata.currency : "";
    const summary =
      typeof metadata.allocationsBeforeSummary === "string"
        ? metadata.allocationsBeforeSummary
        : "—";
    return {
      field: "删款",
      from: `${amount} ${currency} · ${summary}`,
      to: "—",
    };
  }

  if (
    log.eventType === "manual_override" ||
    log.eventType === "reset_to_auto"
  ) {
    const before =
      typeof metadata.allocationsBeforeSummary === "string"
        ? metadata.allocationsBeforeSummary
        : "—";
    const after =
      typeof metadata.allocationsAfterSummary === "string"
        ? metadata.allocationsAfterSummary
        : "—";
    return {
      field:
        log.eventType === "manual_override" ? "冲账分配" : "恢复自动冲账",
      from: before,
      to: after,
    };
  }

  if (log.field) {
    return {
      field: invoicePaymentAuditFieldLabel(log.field),
      from: log.fromValue ?? "—",
      to: log.toValue ?? "—",
    };
  }

  return {
    field: log.eventType,
    from: log.fromValue ?? "—",
    to: log.toValue ?? "—",
  };
}

async function fetchInvoicePaymentAuditEntries(
  dateStr?: string
): Promise<AuditFeedEntry[]> {
  const changedAtWhere = dateStr ? changedAtDayRange(dateStr) : undefined;

  const logs = await prisma.invoicePaymentChangeLog.findMany({
    where: changedAtWhere ? { changedAt: changedAtWhere } : {},
    orderBy: { changedAt: "desc" },
  });

  const actorNames = await loadActorNames(logs.map((log) => log.changedBy));

  const grouped = new Map<string, AuditFeedEntry>();
  for (const log of logs) {
    const key = `${log.paymentId ?? "deleted"}:${log.changedBy}:${groupTimestampKey(log.changedAt)}:${log.eventType}`;
    const metadata = parseInvoicePaymentMetadata(log.metadata);
    const customerName =
      typeof metadata.customerName === "string" && metadata.customerName
        ? metadata.customerName
        : null;
    const customerKey = log.customerKey ?? "";
    const currency = log.currency ?? "";
    const amount =
      metadata.amount != null ? String(metadata.amount) : null;
    const entityLabel = [
      customerName ?? customerKey,
      currency,
      amount ? `${amount} ${currency}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const change = buildInvoicePaymentFeedChange(log);
    const existing = grouped.get(key);
    if (existing) {
      existing.changes.push(change);
      continue;
    }

    grouped.set(key, {
      id: log.id,
      entityType: "invoice_payment",
      entityId: log.paymentId ?? log.id,
      entityLabel: entityLabel || "收账",
      eventType: log.eventType,
      eventTypeLabel: invoicePaymentAuditEventLabel(log.eventType),
      occurredAt: log.changedAt,
      occurredAtDisplay: formatDisplayDateTime(log.changedAt),
      actorName: actorNames.get(log.changedBy) ?? "—",
      changes: [change],
      deepLink:
        customerKey && currency
          ? invoiceCollectionsDeepLink({ customerKey, currency })
          : "/financial/invoice-collections",
    });
  }

  return Array.from(grouped.values());
}

export async function getAuditFeed(input: {
  entityTypes?: AuditEntityType[];
  date?: string;
  cursor?: string;
}): Promise<AuditFeedEntry[]> {
  const entityTypes = input.entityTypes?.length
    ? input.entityTypes
    : ALL_ENTITY_TYPES;

  const batches = await Promise.all([
    entityTypes.includes("inbound")
      ? fetchInboundAuditEntries(input.date)
      : Promise.resolve([]),
    entityTypes.includes("voucher")
      ? fetchVoucherAuditEntries(input.date)
      : Promise.resolve([]),
    entityTypes.includes("payroll")
      ? fetchPayrollAuditEntries(input.date)
      : Promise.resolve([]),
    entityTypes.includes("dispatch") || entityTypes.includes("charter")
      ? fetchDispatchAuditEntries(input.date).then((entries) =>
          entries.filter((entry) => entityTypes.includes(entry.entityType))
        )
      : Promise.resolve([]),
    entityTypes.includes("invoice_payment")
      ? fetchInvoicePaymentAuditEntries(input.date)
      : Promise.resolve([]),
  ]);

  const merged = batches.flat().sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()
  );

  if (!input.cursor) return merged;

  const cursorTime = Number(input.cursor);
  if (!Number.isFinite(cursorTime)) return merged;
  return merged.filter((entry) => entry.occurredAt.getTime() < cursorTime);
}
