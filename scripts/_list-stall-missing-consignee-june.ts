import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

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
      stall: { select: { code: true, market: { select: { code: true } } } },
    },
  });

  const groups = new Map<
    string,
    {
      shipperName: string;
      shipperCode: string;
      marketCode: string;
      stallCode: string;
      lines: number;
      quantity: number;
    }
  >();

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
      const marketCode =
        ctx.stalls.get(line.stallId)?.marketCode ??
        line.stall.market?.code ??
        "";
      const stallCode = line.stall.code;
      const input = {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
      };
      const snapshot = computeInboundLineFreight(input, ctx);
      const reason = classifyInboundFreightGap(input, ctx, snapshot);
      if (reason !== "stall_missing_consignee") continue;

      const key = `${line.session.shipper.code}|${marketCode}|${stallCode}`;
      const existing = groups.get(key);
      if (existing) {
        existing.lines += 1;
        existing.quantity += line.quantity;
      } else {
        groups.set(key, {
          shipperName: line.session.shipper.name,
          shipperCode: line.session.shipper.code,
          marketCode,
          stallCode,
          lines: 1,
          quantity: line.quantity,
        });
      }
    }
  }

  const rows = Array.from(groups.values()).sort((a, b) => b.quantity - a.quantity);

  console.log("stall_missing_consignee — June 2026 dispatched lines\n");
  console.log(
    "寄货人名称 | 市场 | 档口代码 | 行数 | 桶数"
  );
  console.log("-".repeat(70));
  for (const row of rows) {
    console.log(
      `${row.shipperName} | ${row.marketCode} | ${row.stallCode} | ${row.lines} | ${row.quantity}`
    );
  }
  console.log("-".repeat(70));
  console.log(
    `合计: ${rows.length} 组, ${rows.reduce((s, r) => s + r.lines, 0)} 行, ${rows.reduce((s, r) => s + r.quantity, 0)} 桶`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
