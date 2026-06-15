import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

async function main() {
  const { start, end } = getMonthDateRange(2026, 6);

  const shippersNoRate = await prisma.$queryRaw<
    { code: string; name: string; lines: bigint; qty: bigint }[]
  >`
    SELECT s.code, s.name, COUNT(il.id) AS lines, SUM(il.quantity) AS qty
    FROM inbound_lines il
    JOIN inbound_sessions ins ON ins.id = il.session_id
    JOIN shippers s ON s.id = ins.shipper_id
    JOIN dispatch_lines dl ON dl.inbound_line_id = il.id
    JOIN dispatch_orders d ON d.id = dl.dispatch_order_id
    LEFT JOIN stalls st ON st.id = il.stall_id
    LEFT JOIN markets m ON m.id = st.market_id
    LEFT JOIN freight_rates fr ON fr.shipper_id = s.id AND fr.market_id = m.id
    WHERE il.dispatch_status = 'assigned'
      AND d.date >= ${start} AND d.date <= ${end}
      AND d.status NOT IN ('draft', 'cancelled')
      AND fr.id IS NULL
    GROUP BY s.code, s.name
    ORDER BY qty DESC
    LIMIT 20
  `;

  console.log("shippers with missing freight_rates (top 20):");
  for (const row of shippersNoRate) {
    console.log(`${row.code} | ${row.name} | lines=${row.lines} qty=${row.qty}`);
  }

  const rateCount = await prisma.freightRate.count();
  const shipperWithRates = await prisma.freightRate.groupBy({
    by: ["shipperId"],
    _count: true,
  });
  console.log("\nfreight_rates total:", rateCount, "shippers with rates:", shipperWithRates.length);

  const tata = await prisma.shipper.findMany({
    where: { name: { contains: "TATA", mode: "insensitive" } },
    select: { code: true, name: true, _count: { select: { freightRates: true } } },
  });
  console.log("\nTATA shippers:", tata);
}

main().finally(() => prisma.$disconnect());
