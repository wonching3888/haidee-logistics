"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/inbound-utils";
import { formatDisplayDate } from "@/lib/date-utils";
import {
  formatPickupLocationLabel,
  resolveSessionPickupLocation,
} from "@/lib/constants/pickup-locations";
import { format } from "date-fns";

export interface InboundModificationRecord {
  id: string;
  sessionNo: string | null;
  sessionDate: string;
  shipperName: string;
  pickupLocationLabel: string;
  modifiedAt: string;
  modifiedBy: string;
  changes: { field: string; from: string; to: string }[];
}

export async function getInboundModifications(
  dateStr?: string
): Promise<InboundModificationRecord[]> {
  const dateFilter = dateStr ? parseDateInput(dateStr) : undefined;
  const sessionDateWhere = dateFilter ? { date: dateFilter } : undefined;

  const changeLogs = await prisma.inboundChangeLog.findMany({
    where: sessionDateWhere ? { session: sessionDateWhere } : {},
    include: {
      session: {
        select: {
          sessionNo: true,
          date: true,
          pickupLocation: true,
          shipper: { select: { name: true, pickupLocation: true } },
        },
      },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const groupedChangeLogs = new Map<string, InboundModificationRecord>();
  for (const log of changeLogs) {
    const key = `${log.sessionId}:${log.userId ?? "unknown"}:${format(
      log.createdAt,
      "yyyy-MM-dd HH:mm:ss"
    )}`;
    const existing = groupedChangeLogs.get(key);
    const change = {
      field: log.field,
      from: log.fromValue,
      to: log.toValue,
    };

    if (existing) {
      existing.changes.push(change);
      continue;
    }

    groupedChangeLogs.set(key, {
      id: log.id,
      sessionNo: log.session.sessionNo,
      sessionDate: formatDisplayDate(log.session.date),
      shipperName: log.session.shipper.name,
      pickupLocationLabel: formatPickupLocationLabel(
        resolveSessionPickupLocation(
          log.session.pickupLocation,
          log.session.shipper.pickupLocation
        )
      ),
      modifiedAt: format(log.createdAt, "dd/MM/yyyy HH:mm"),
      modifiedBy: log.user?.name ?? "—",
      changes: [change],
    });
  }

  const sessionsWithChangeLogs = new Set(
    changeLogs.map((log) => log.sessionId)
  );

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
          sessionNo: true,
          date: true,
          areaNote: true,
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

  const legacyRecords: InboundModificationRecord[] = legacyLines.map((line) => ({
    id: line.id,
    sessionNo: line.session.sessionNo,
    sessionDate: formatDisplayDate(line.session.date),
    shipperName: line.session.shipper.name,
    pickupLocationLabel: formatPickupLocationLabel(
      resolveSessionPickupLocation(
        line.session.pickupLocation,
        line.session.shipper.pickupLocation
      )
    ),
    modifiedAt: line.modifiedAt
      ? format(line.modifiedAt, "dd/MM/yyyy HH:mm")
      : "—",
    modifiedBy: "—",
    changes: buildLegacyChanges(line),
  }));

  return [...Array.from(groupedChangeLogs.values()), ...legacyRecords].sort(
    (a, b) => {
      const parseSortTime = (value: string) => {
        if (value === "—") return 0;
        const [datePart, timePart] = value.split(" ");
        const [day, month, year] = datePart.split("/").map(Number);
        const [hour, minute] = timePart.split(":").map(Number);
        return new Date(year, month - 1, day, hour, minute).getTime();
      };
      return parseSortTime(b.modifiedAt) - parseSortTime(a.modifiedAt);
    }
  );
}

function buildLegacyChanges(line: {
  originalQuantity: number | null;
  quantity: number;
  originalTongType: { code: string; name: string } | null;
  tongType: { code: string; name: string };
  originalStall: { code: string; market: { code: string } | null } | null;
  stall: { code: string; market: { code: string } | null };
}) {
  const changes: { field: string; from: string; to: string }[] = [];

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
        field: "档口 Stall",
        from: origLabel,
        to: newLabel,
      });
    }
  }

  return changes;
}
