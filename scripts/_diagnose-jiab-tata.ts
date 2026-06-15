import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

async function main() {
  const { start, end } = getMonthDateRange(2026, 6);

  for (const code of ["3001/J001", "3001/T006", "3001-010", "300-Y002", "3002-S006"]) {
    const shipper = await prisma.shipper.findFirst({
      where: { code },
      include: {
        paymentRelations: {
          include: { consignee: { select: { code: true, name: true } } },
        },
        freightRates: { include: { market: { select: { code: true } } } },
      },
    });
    if (!shipper) {
      console.log(`\n${code}: NOT FOUND`);
      continue;
    }
    console.log(`\n=== ${code} ${shipper.name} ===`);
    console.log(
      "payment relations:",
      shipper.paymentRelations.map((r) => `${r.consignee.code} mode=${r.paymentMode}`)
    );
    console.log(
      "shipper rates:",
      shipper.freightRates.map((r) => `${r.market.code} tong=${r.rateTong}`)
    );

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
        quantity: true,
        stall: {
          select: {
            market: { select: { code: true } },
            consignee: { select: { code: true, name: true } },
          },
        },
      },
    });

    const byConsigneeMarket = new Map<string, number>();
    for (const line of lines) {
      const key = `${line.stall.consignee?.code ?? "NONE"}@${line.stall.market?.code ?? "?"}`;
      byConsigneeMarket.set(key, (byConsigneeMarket.get(key) ?? 0) + line.quantity);
    }
    console.log("june dispatch qty by consignee@market:", Object.fromEntries(byConsigneeMarket));
  }

  const consigneeRates = await prisma.consigneeFreightRate.findMany({
    include: { consignee: { select: { code: true, name: true } }, market: { select: { code: true } } },
  });
  console.log("\nall consignee_freight_rates:", consigneeRates.length);
  for (const r of consigneeRates) {
    console.log(`  ${r.consignee.code} ${r.market.code} tong=${r.rateTong}`);
  }
}

main().finally(() => prisma.$disconnect());
