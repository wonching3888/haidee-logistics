import { toDateInputValue } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";

export interface RateSaveWarning {
  partyLabel: string;
  tripCount: number;
  earliestBusinessDate: string;
  message: string;
}

function formatPartyLabel(name: string, code: string) {
  return `${name} (${code})`;
}

function buildWarningMessage(input: {
  partyLabel: string;
  tripCount: number;
  earliestBusinessDate: string;
}) {
  return `⚠️ 有 ${input.tripCount} 趟未定价的车（最早 ${input.earliestBusinessDate}）业务日早于这个生效日，这费率盖不到它们、会留未定价。要把生效日提前吗？`;
}

async function aggregateUnpricedTripsBeforeDate(
  lines: Array<{ sessionId: string; sessionDate: Date }>
): Promise<{ tripCount: number; earliestBusinessDate: string | null }> {
  if (lines.length === 0) {
    return { tripCount: 0, earliestBusinessDate: null };
  }

  const sessionIds = new Set(lines.map((line) => line.sessionId));
  let earliest = lines[0].sessionDate;
  for (const line of lines) {
    if (line.sessionDate < earliest) {
      earliest = line.sessionDate;
    }
  }

  return {
    tripCount: sessionIds.size,
    earliestBusinessDate: toDateInputValue(earliest),
  };
}

export async function checkShipperRateSaveWarning(input: {
  shipperId: string;
  marketIds: string[];
  effectiveDate: Date;
}): Promise<RateSaveWarning | null> {
  if (input.marketIds.length === 0) return null;

  const shipper = await prisma.shipper.findUnique({
    where: { id: input.shipperId },
    select: { name: true, code: true },
  });
  if (!shipper) return null;

  const lines = await prisma.inboundLine.findMany({
    where: {
      freightAmount: null,
      session: {
        status: "confirmed",
        shipperId: input.shipperId,
        date: { lt: input.effectiveDate },
      },
      stall: { marketId: { in: input.marketIds } },
    },
    select: {
      sessionId: true,
      session: { select: { date: true } },
    },
  });

  const { tripCount, earliestBusinessDate } = await aggregateUnpricedTripsBeforeDate(
    lines.map((line) => ({
      sessionId: line.sessionId,
      sessionDate: line.session.date,
    }))
  );

  if (tripCount === 0 || !earliestBusinessDate) return null;

  const partyLabel = formatPartyLabel(shipper.name, shipper.code);
  return {
    partyLabel,
    tripCount,
    earliestBusinessDate,
    message: buildWarningMessage({ partyLabel, tripCount, earliestBusinessDate }),
  };
}

export async function checkConsigneeRateSaveWarning(input: {
  consigneeId: string;
  marketIds: string[];
  effectiveDate: Date;
}): Promise<RateSaveWarning | null> {
  if (input.marketIds.length === 0) return null;

  const consignee = await prisma.consignee.findUnique({
    where: { id: input.consigneeId },
    select: { name: true, code: true },
  });
  if (!consignee) return null;

  const lines = await prisma.inboundLine.findMany({
    where: {
      freightAmount: null,
      session: {
        status: "confirmed",
        date: { lt: input.effectiveDate },
      },
      stall: { marketId: { in: input.marketIds } },
      OR: [
        { consigneeId: input.consigneeId },
        { stall: { consigneeId: input.consigneeId } },
      ],
    },
    select: {
      sessionId: true,
      session: { select: { date: true } },
    },
  });

  const { tripCount, earliestBusinessDate } = await aggregateUnpricedTripsBeforeDate(
    lines.map((line) => ({
      sessionId: line.sessionId,
      sessionDate: line.session.date,
    }))
  );

  if (tripCount === 0 || !earliestBusinessDate) return null;

  const partyLabel = formatPartyLabel(consignee.name, consignee.code);
  return {
    partyLabel,
    tripCount,
    earliestBusinessDate,
    message: buildWarningMessage({ partyLabel, tripCount, earliestBusinessDate }),
  };
}
