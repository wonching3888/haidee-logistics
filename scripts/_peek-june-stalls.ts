import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

async function main() {
  const { start, end } = getMonthDateRange(2026, 6);
  for (const code of ["3001/J001", "3001-003", "300-Y002", "3002-S006"]) {
    const shipper = await prisma.shipper.findFirst({ where: { code } });
    if (!shipper) {
      console.log(code, "NOT FOUND");
      continue;
    }
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
        stall: { select: { code: true, name: true, consigneeId: true, market: { select: { code: true } } } },
      },
    });
    const grouped = new Map<string, number>();
    for (const line of lines) {
      const key = `${line.stall.market?.code} ${line.stall.code} consignee=${line.stall.consigneeId ?? "null"}`;
      grouped.set(key, (grouped.get(key) ?? 0) + line.quantity);
    }
    console.log(`\n${code} (${lines.length} lines):`, Object.fromEntries(grouped));
  }
}

main().finally(() => prisma.$disconnect());
