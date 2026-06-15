import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { aggregateOperationsIncome } from "@/lib/operations-income";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { convertThbToMyr, decimalToNumber } from "@/lib/freight-rates";

async function main() {
  const { start, end } = getMonthDateRange(2026, 6);
  const exchangeRate =
    decimalToNumber(
      (await prisma.exchangeRate.findUnique({ where: { yearMonth: "2026-06" } }))
        ?.rate
    ) ?? DEFAULT_EXCHANGE_RATE;

  const shipper = await prisma.shipper.findUnique({ where: { code: "3000-B002" } });
  if (!shipper) throw new Error("BEST BROTHER not found");

  const lines = await prisma.inboundLine.findMany({
    where: {
      session: { shipperId: shipper.id },
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
          pickupLocation: true,
          shipper: { select: { pickupLocation: true } },
        },
      },
    },
  });

  const { ctx } = await loadInboundFreightContext(
    shipper.id,
    Array.from(new Set(lines.map((l) => l.stallId))),
    Array.from(new Set(lines.map((l) => l.tongTypeId))),
    end,
    resolveSessionPickupLocation(
      lines[0]?.session.pickupLocation,
      lines[0]?.session.shipper.pickupLocation
    )
  );

  let mode1bMyr = 0;
  let qty = 0;
  for (const line of lines) {
    const marketCode = ctx.stalls.get(line.stallId)?.marketCode ?? "";
    const snap = computeInboundLineFreight(
      {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
      },
      ctx
    );
    qty += line.quantity;
    if (snap.paymentMode === "1b" && (snap.freightAmount ?? 0) > 0) {
      mode1bMyr += snap.freightAmount ?? 0;
    }
  }

  const income = await aggregateOperationsIncome(2026, 6);
  const totalMyr =
    convertThbToMyr(income.mode1aThb, exchangeRate) +
    income.mode1bMyr +
    income.mode2Myr +
    income.wtlMode3Myr;

  console.log(
    JSON.stringify(
      {
        bestBrother: {
          code: "3000-B002",
          lines: lines.length,
          quantity: qty,
          mode1bMyr: Math.round(mode1bMyr * 100) / 100,
        },
        juneIncome: income,
        totalMyr: Math.round(totalMyr * 100) / 100,
      },
      null,
      2
    )
  );
}

main().finally(() => prisma.$disconnect());
