import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  isMissingRateGap,
  normalizeMcDeliveryMode,
  type InboundFreightGapReason,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

const REASON_LABELS: Record<InboundFreightGapReason, string> = {
  no_market_on_stall: "档口未关联市场",
  stall_missing_consignee: "档口未绑定收货人",
  no_shipper_rate: "寄货人费率未设定",
  shipper_missing_tong_rate: "寄货人桶型费率缺失",
  shipper_missing_box_rate: "寄货人箱型费率缺失",
  no_consignee_rate: "收货人费率未设定",
  consignee_missing_tong_rate: "收货人桶型费率缺失",
  consignee_missing_box_rate: "收货人箱型费率缺失",
  mc_self_delivery: "MC自送（客户运费0）",
  mc_third_party_customer_zero: "MC第三方代送（客户运费0）",
};

async function main() {
  const { start, end } = getMonthDateRange(2026, 6);

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
      isBox: true,
      mcDeliveryMode: true,
      session: {
        select: {
          shipperId: true,
          pickupLocation: true,
          shipper: {
            select: {
              code: true,
              name: true,
              currency: true,
              pickupLocation: true,
            },
          },
        },
      },
      stall: {
        select: {
          code: true,
          market: { select: { code: true } },
        },
      },
      tongType: { select: { code: true, isBox: true } },
    },
  });

  type GroupKey = string;
  const groups = new Map<
    GroupKey,
    {
      shipperCode: string;
      shipperName: string;
      shipperCurrency: string;
      marketCode: string;
      reason: InboundFreightGapReason;
      reasonLabel: string;
      lines: number;
      quantity: number;
      stalls: Set<string>;
      tongTypes: Set<string>;
    }
  >();

  let totalZeroLines = 0;
  let totalZeroQty = 0;
  let missingRateLines = 0;
  let missingRateQty = 0;

  const linesByShipper = new Map<string, typeof lines>();
  for (const line of lines) {
    const g = linesByShipper.get(line.session.shipperId) ?? [];
    g.push(line);
    linesByShipper.set(line.session.shipperId, g);
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
        ctx.stalls.get(line.stallId)?.marketCode ?? line.stall.market?.code ?? "";
      const input = {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
      };
      const snapshot = computeInboundLineFreight(input, ctx);
      const amount = snapshot.freightAmount ?? 0;
      if (amount > 0) continue;

      totalZeroLines += 1;
      totalZeroQty += line.quantity;

      const reason =
        classifyInboundFreightGap(input, ctx, snapshot) ?? "mc_self_delivery";
      if (isMissingRateGap(reason)) {
        missingRateLines += 1;
        missingRateQty += line.quantity;
      }

      const key = `${line.session.shipper.code}|${marketCode}|${reason}`;
      const existing = groups.get(key);
      if (existing) {
        existing.lines += 1;
        existing.quantity += line.quantity;
        existing.stalls.add(line.stall.code);
        existing.tongTypes.add(line.tongType.code);
      } else {
        groups.set(key, {
          shipperCode: line.session.shipper.code,
          shipperName: line.session.shipper.name,
          shipperCurrency: line.session.shipper.currency,
          marketCode,
          reason,
          reasonLabel: REASON_LABELS[reason] ?? reason,
          lines: 1,
          quantity: line.quantity,
          stalls: new Set([line.stall.code]),
          tongTypes: new Set([line.tongType.code]),
        });
      }
    }
  }

  const rows = Array.from(groups.values()).sort((a, b) => b.quantity - a.quantity);

  console.log("6月无收入派车明细（freightAmount = 0）\n");
  console.log(
    "寄货人编码 | 寄货人名称 | 货币 | 市场 | 原因 | 行数 | 桶数 | 档口 | 桶型"
  );
  console.log("-".repeat(100));

  for (const row of rows) {
    console.log(
      [
        row.shipperCode,
        row.shipperName,
        row.shipperCurrency,
        row.marketCode,
        row.reasonLabel,
        row.lines,
        row.quantity,
        [...row.stalls].sort().join(","),
        [...row.tongTypes].sort().join(","),
      ].join(" | ")
    );
  }

  console.log("-".repeat(100));
  console.log(
    JSON.stringify(
      {
        totalDispatchedLines: lines.length,
        zeroRevenueLines: totalZeroLines,
        zeroRevenueQuantity: totalZeroQty,
        missingRateLines,
        missingRateQuantity: missingRateQty,
        groupCount: rows.length,
        byReason: Object.fromEntries(
          rows.reduce((map, row) => {
            map.set(row.reason, (map.get(row.reason) ?? 0) + row.quantity);
            return map;
          }, new Map<string, number>())
        ),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
