import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
  type InboundFreightGapReason,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

type GroupKey = string;

interface GroupStats {
  shipperCode: string;
  shipperName: string;
  marketCode: string;
  reason: InboundFreightGapReason;
  lines: number;
  quantity: number;
}

async function main() {
  const year = 2026;
  const month = 6;
  const { start, end } = getMonthDateRange(year, month);

  const lines = await prisma.inboundLine.findMany({
    where: {
      dispatchStatus: "assigned",
      dispatchLines: {
        some: {
          dispatchOrder: {
            date: { gte: start, lte: end },
            status: { notIn: ["draft", "cancelled"] },
          },
        },
      },
    },
    select: {
      stallId: true,
      tongTypeId: true,
      quantity: true,
      mcDeliveryMode: true,
      session: {
        select: {
          shipperId: true,
          pickupLocation: true,
          shipper: { select: { name: true, code: true, pickupLocation: true } },
        },
      },
    },
  });

  const groups = new Map<GroupKey, GroupStats>();
  const linesByShipper = new Map<string, typeof lines>();

  for (const line of lines) {
    const group = linesByShipper.get(line.session.shipperId) ?? [];
    group.push(line);
    linesByShipper.set(line.session.shipperId, group);
  }

  for (const [shipperId, shipperLines] of Array.from(linesByShipper.entries())) {
    const stallIds = Array.from(new Set(shipperLines.map((l) => l.stallId)));
    const tongTypeIds = Array.from(new Set(shipperLines.map((l) => l.tongTypeId)));
    const pickupLocation = resolveSessionPickupLocation(
      shipperLines[0]?.session.pickupLocation,
      shipperLines[0]?.session.shipper.pickupLocation
    );
    const { ctx } = await loadInboundFreightContext(
      shipperId,
      stallIds,
      tongTypeIds,
      end,
      pickupLocation
    );

    for (const line of shipperLines) {
      const marketCode = ctx.stalls.get(line.stallId)?.marketCode ?? "";
      const snapshot = computeInboundLineFreight(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
        },
        ctx
      );
      const reason = classifyInboundFreightGap(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
        },
        ctx,
        snapshot
      );
      if (!reason || reason !== "no_shipper_rate") continue;

      const key = `${line.session.shipper.code}|${marketCode}`;
      const existing = groups.get(key);
      if (existing) {
        existing.lines += 1;
        existing.quantity += line.quantity;
      } else {
        groups.set(key, {
          shipperCode: line.session.shipper.code,
          shipperName: line.session.shipper.name,
          marketCode,
          reason,
          lines: 1,
          quantity: line.quantity,
        });
      }
    }
  }

  const rows = Array.from(groups.values()).sort((a, b) => b.quantity - a.quantity);

  console.log(
    JSON.stringify(
      {
        reason: "no_shipper_rate",
        month: `${year}-${String(month).padStart(2, "0")}`,
        groupCount: rows.length,
        totalLines: rows.reduce((sum, row) => sum + row.lines, 0),
        totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
        groups: rows.map((row) => ({
          key: `${row.shipperCode} | ${row.shipperName} | ${row.marketCode}`,
          lines: row.lines,
          quantity: row.quantity,
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
