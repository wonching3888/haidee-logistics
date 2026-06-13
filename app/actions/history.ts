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

export async function getInboundModifications(dateStr?: string) {
  const where: Prisma.InboundLineWhereInput = {
    originalQuantity: { not: null },
  };

  if (dateStr) {
    where.session = { date: parseDateInput(dateStr) };
  }

  const lines = await prisma.inboundLine.findMany({
    where,
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

  return lines.map((l) => ({
    id: l.id,
    sessionNo: l.session.sessionNo,
    sessionDate: formatDisplayDate(l.session.date),
    shipperName: l.session.shipper.name,
    pickupLocationLabel: formatPickupLocationLabel(
      resolveSessionPickupLocation(
        l.session.pickupLocation,
        l.session.shipper.pickupLocation
      )
    ),
    modifiedAt: l.modifiedAt ? format(l.modifiedAt, "dd/MM/yyyy HH:mm") : "—",
    changes: buildChanges(l),
  }));
}

function buildChanges(line: {
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
