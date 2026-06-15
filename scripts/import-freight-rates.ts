import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveEffectiveDateInput } from "@/lib/freight-rates";
import {
  CONSIGNEE_RATE_ROWS,
  SHIPPER_RATE_ROWS,
  type RateRow,
} from "./data/freight-rates-v3";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type UpsertStats = {
  inserted: number;
  updated: number;
  skipped: number;
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasImportableRate(row: RateRow) {
  return isFiniteNumber(row.tong) || isFiniteNumber(row.box);
}

async function printTableStructure(table: string) {
  const cols = await prisma.$queryRawUnsafe<
    { column_name: string; data_type: string }[]
  >(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}'
     ORDER BY ordinal_position`
  );
  console.log(`\n=== ${table} columns ===`);
  if (cols.length === 0) {
    console.log("  (table not found)");
    return;
  }
  for (const col of cols) {
    console.log(`  ${col.column_name} (${col.data_type})`);
  }
}

async function importShipperRates(effectiveDate: Date) {
  const shippers = await prisma.shipper.findMany({
    select: { id: true, code: true, currency: true },
  });
  const markets = await prisma.market.findMany({
    select: { id: true, code: true },
  });

  const shipperByCode = new Map(shippers.map((item) => [item.code, item]));
  const marketByCode = new Map(markets.map((item) => [item.code, item]));

  const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };

  for (const row of SHIPPER_RATE_ROWS) {
    if (!hasImportableRate(row)) {
      stats.skipped += 1;
      continue;
    }

    const shipper = shipperByCode.get(row.code);
    if (!shipper) {
      console.warn(`skip shipper rate: missing shipper code ${row.code}`);
      stats.skipped += 1;
      continue;
    }

    const market = marketByCode.get(row.market);
    if (!market) {
      console.warn(
        `skip shipper rate: missing market code ${row.market} (${row.code})`
      );
      stats.skipped += 1;
      continue;
    }

    const existing = await prisma.freightRate.findUnique({
      where: {
        shipperId_marketId_effectiveDate: {
          shipperId: shipper.id,
          marketId: market.id,
          effectiveDate,
        },
      },
      select: { id: true },
    });

    await prisma.freightRate.upsert({
      where: {
        shipperId_marketId_effectiveDate: {
          shipperId: shipper.id,
          marketId: market.id,
          effectiveDate,
        },
      },
      create: {
        shipperId: shipper.id,
        marketId: market.id,
        rateTong: isFiniteNumber(row.tong) ? row.tong : null,
        rateBox: isFiniteNumber(row.box) ? row.box : null,
        currency: shipper.currency,
        effectiveDate,
      },
      update: {
        rateTong: isFiniteNumber(row.tong) ? row.tong : null,
        rateBox: isFiniteNumber(row.box) ? row.box : null,
        currency: shipper.currency,
      },
    });

    if (existing) stats.updated += 1;
    else stats.inserted += 1;
  }

  return stats;
}

async function importConsigneeRates(effectiveDate: Date) {
  const consignees = await prisma.consignee.findMany({
    select: { id: true, code: true },
  });
  const markets = await prisma.market.findMany({
    select: { id: true, code: true },
  });

  const consigneeByCode = new Map(consignees.map((item) => [item.code, item]));
  const marketByCode = new Map(markets.map((item) => [item.code, item]));

  const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };

  for (const row of CONSIGNEE_RATE_ROWS) {
    if (!hasImportableRate(row)) {
      stats.skipped += 1;
      continue;
    }

    const consignee = consigneeByCode.get(row.code);
    if (!consignee) {
      console.warn(`skip consignee rate: missing consignee code ${row.code}`);
      stats.skipped += 1;
      continue;
    }

    const market = marketByCode.get(row.market);
    if (!market) {
      console.warn(
        `skip consignee rate: missing market code ${row.market} (${row.code})`
      );
      stats.skipped += 1;
      continue;
    }

    const existing = await prisma.consigneeFreightRate.findUnique({
      where: {
        consigneeId_marketId_effectiveDate: {
          consigneeId: consignee.id,
          marketId: market.id,
          effectiveDate,
        },
      },
      select: { id: true },
    });

    await prisma.consigneeFreightRate.upsert({
      where: {
        consigneeId_marketId_effectiveDate: {
          consigneeId: consignee.id,
          marketId: market.id,
          effectiveDate,
        },
      },
      create: {
        consigneeId: consignee.id,
        marketId: market.id,
        rateTong: isFiniteNumber(row.tong) ? row.tong : null,
        rateBox: isFiniteNumber(row.box) ? row.box : null,
        effectiveDate,
      },
      update: {
        rateTong: isFiniteNumber(row.tong) ? row.tong : null,
        rateBox: isFiniteNumber(row.box) ? row.box : null,
      },
    });

    if (existing) stats.updated += 1;
    else stats.inserted += 1;
  }

  return stats;
}

async function main() {
  await printTableStructure("freight_rates");
  await printTableStructure("consignee_freight_rates");

  const effectiveDate = resolveEffectiveDateInput({ immediate: true });
  console.log(`\nUsing effective_date: ${effectiveDate.toISOString().slice(0, 10)}`);

  const shipperStats = await importShipperRates(effectiveDate);
  const consigneeStats = await importConsigneeRates(effectiveDate);

  const [shipperTotal, consigneeTotal] = await Promise.all([
    prisma.freightRate.count(),
    prisma.consigneeFreightRate.count(),
  ]);

  console.log("\n=== Import Results ===");
  console.log(
    `freight_rates: inserted=${shipperStats.inserted}, updated=${shipperStats.updated}, skipped=${shipperStats.skipped}, total=${shipperTotal}`
  );
  console.log(
    `consignee_freight_rates: inserted=${consigneeStats.inserted}, updated=${consigneeStats.updated}, skipped=${consigneeStats.skipped}, total=${consigneeTotal}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
