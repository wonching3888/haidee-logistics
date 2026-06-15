import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const dupes = await prisma.$queryRaw<
    { name: string; codes: string[]; cnt: bigint }[]
  >`
    SELECT name, array_agg(code ORDER BY code) AS codes, count(*)::bigint AS cnt
    FROM shippers GROUP BY name HAVING count(*) > 1
    ORDER BY cnt DESC LIMIT 20
  `;
  console.log("duplicate shipper names:");
  for (const row of dupes) {
    const rates = await Promise.all(
      row.codes.map(async (code) => {
        const s = await prisma.shipper.findFirst({
          where: { code },
          include: { _count: { select: { freightRates: true } } },
        });
        return `${code}:${s?._count.freightRates ?? 0}`;
      })
    );
    console.log(`  ${row.name} (${row.cnt}) -> ${rates.join(", ")}`);
  }

  const codes = [
    "3001/J001",
    "3001-002",
    "3001/T006",
    "3001-010",
    "300-Y002",
    "3001-Y002",
    "3001-S001",
  ];
  for (const code of codes) {
    const s = await prisma.shipper.findFirst({
      where: { code },
      include: { _count: { select: { freightRates: true, paymentRelations: true } } },
    });
    console.log(
      code,
      s
        ? {
            rates: s._count.freightRates,
            relations: s._count.paymentRelations,
          }
        : "NOT FOUND"
    );
  }
}

main().finally(() => prisma.$disconnect());
