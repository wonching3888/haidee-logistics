import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

async function main() {
  const { start, end } = getMonthDateRange(2026, 6);

  const shippers = await prisma.shipper.findMany({
    where: { name: { contains: "BEST BROTHER", mode: "insensitive" } },
    select: { id: true, code: true, name: true, currency: true, active: true },
    orderBy: { code: "asc" },
  });

  console.log("BEST BROTHER 寄货人:");
  console.log(JSON.stringify(shippers, null, 2));

  if (shippers.length === 0) {
    console.log("\n未找到 BEST BROTHER 相关寄货人");
    return;
  }

  console.log("\n6月派车情况 (dispatch_status=assigned, dispatch_orders 在 2026-06):");
  for (const shipper of shippers) {
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
        isBox: true,
        stall: { select: { code: true, market: { select: { code: true } } } },
        tongType: { select: { code: true } },
        dispatchLines: {
          select: {
            dispatchOrder: { select: { date: true, dispatchNo: true } },
          },
        },
      },
    });

    const totalQty = lines.reduce((sum, line) => sum + line.quantity, 0);
    const byMarket = new Map<string, number>();
    for (const line of lines) {
      const market = line.stall.market?.code ?? "?";
      byMarket.set(market, (byMarket.get(market) ?? 0) + line.quantity);
    }

    console.log(
      `\n${shipper.name} (${shipper.code}) currency=${shipper.currency}:`
    );
    console.log(`  6月派车: ${lines.length} 行, 总桶数 ${totalQty}`);
    if (byMarket.size > 0) {
      console.log(
        `  按市场: ${JSON.stringify(Object.fromEntries(byMarket))}`
      );
    }
  }

  const allSessions = await prisma.inboundSession.findMany({
    where: {
      shipperId: { in: shippers.map((s) => s.id) },
      date: { gte: start, lte: end },
    },
    select: {
      sessionNo: true,
      date: true,
      shipper: { select: { code: true, name: true } },
      _count: { select: { lines: true } },
    },
  });
  if (allSessions.length > 0) {
    console.log("\n6月 inbound_sessions（含未派车）:");
    for (const s of allSessions) {
      console.log(
        `  ${s.shipper.code} ${s.date.toISOString().slice(0, 10)} session=${s.sessionNo ?? s.date} lines=${s._count.lines}`
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
