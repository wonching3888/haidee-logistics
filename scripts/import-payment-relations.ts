import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const PAYMENT_RELATION_ROWS = [
  { shipper: "HOE - SONGKHLA", consignee: "KL G54", mode: 2 },
  { shipper: "J.P FISHERY", consignee: "KL G54", mode: 2 },
  { shipper: "JIAB", consignee: "KL B53", mode: 2 },
  { shipper: "JIAB", consignee: "KL G36", mode: 2 },
  { shipper: "JIAB", consignee: "KL F56", mode: 2 },
  { shipper: "JIAB", consignee: "MC MC65", mode: 3 },
  { shipper: "JIT RANONG", consignee: "KL A53", mode: 2 },
  { shipper: "JIT RANONG", consignee: "KL B39", mode: 2 },
  { shipper: "JIT RANONG", consignee: "KL D46", mode: 2 },
  { shipper: "JIT RANONG", consignee: "KL F49", mode: 2 },
  { shipper: "JIT RANONG", consignee: "A A43", mode: 2 },
  { shipper: "JIT RANONG", consignee: "BM BM45", mode: 2 },
  { shipper: "KIM 9", consignee: "KL A48", mode: 2 },
  { shipper: "KIM 9", consignee: "KL C42", mode: 2 },
  { shipper: "KIM 9", consignee: "KL C44", mode: 2 },
  { shipper: "KIM 9", consignee: "KL C55", mode: 2 },
  { shipper: "KIM 9", consignee: "KL E36", mode: 2 },
  { shipper: "KIM 9", consignee: "KL E38", mode: 2 },
  { shipper: "KO CHEEP", consignee: "KL G54", mode: 2 },
  { shipper: "LITA", consignee: "KL F40", mode: 2 },
  { shipper: "PT PHUKET", consignee: "KL G54", mode: 2 },
  { shipper: "SOPHON", consignee: "NT NKL", mode: 3 },
  { shipper: "TANAPORN", consignee: "KL G54", mode: 2 },
  { shipper: "TATA", consignee: "KL F40", mode: 2 },
  { shipper: "TN", consignee: "KL A56", mode: 2 },
  { shipper: "CHUN MENG", consignee: "A A56", mode: 2 },
  { shipper: "CHUN MENG", consignee: "A B51", mode: 2 },
  { shipper: "SENG HUAT - TAKOR", consignee: "KL C42", mode: 2 },
] as const;

type UpsertStats = { inserted: number; updated: number; skipped: number };

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function consigneePrefix(name: string) {
  const trimmed = name.trim();
  const dashIndex = trimmed.indexOf(" - ");
  return normalizeName(
    dashIndex >= 0 ? trimmed.slice(0, dashIndex) : trimmed
  );
}

function findShipperByName<T extends { id: string; name: string }>(
  shippers: T[],
  shipperName: string
) {
  const target = normalizeName(shipperName);
  const exact = shippers.filter((item) => normalizeName(item.name) === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return exact[0];

  const starts = shippers.filter((item) =>
    normalizeName(item.name).startsWith(target)
  );
  if (starts.length === 1) return starts[0];

  const contains = shippers.filter((item) =>
    normalizeName(item.name).includes(target)
  );
  if (contains.length === 1) return contains[0];

  return null;
}

function findConsigneeByCode<T extends { id: string; name: string; code: string }>(
  consignees: T[],
  consigneeCode: string
) {
  const target = normalizeName(consigneeCode);
  const byPrefix = consignees.filter(
    (item) => consigneePrefix(item.name) === target
  );
  if (byPrefix.length === 1) return byPrefix[0];

  const byCode = consignees.filter(
    (item) => normalizeName(item.code) === target
  );
  if (byCode.length === 1) return byCode[0];

  const byName = consignees.filter(
    (item) => normalizeName(item.name) === target
  );
  if (byName.length === 1) return byName[0];

  return null;
}

function mapPaymentMode(mode: number) {
  return String(mode);
}

async function printTableStructure() {
  const cols = await prisma.$queryRawUnsafe<
    { column_name: string; data_type: string }[]
  >(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'payment_relations'
     ORDER BY ordinal_position`
  );
  console.log("=== payment_relations columns ===");
  for (const col of cols) {
    console.log(`  ${col.column_name} (${col.data_type})`);
  }
  console.log(
    "  unique: (shipper_id, consignee_id) — matched by shipper name + consignee prefix"
  );
}

async function main() {
  await printTableStructure();

  const shippers = await prisma.shipper.findMany({
    select: { id: true, name: true, code: true },
  });
  const consignees = await prisma.consignee.findMany({
    select: { id: true, name: true, code: true },
  });

  const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };

  for (const row of PAYMENT_RELATION_ROWS) {
    const shipper = findShipperByName(shippers, row.shipper);
    if (!shipper) {
      console.warn(`skip: shipper not found "${row.shipper}"`);
      stats.skipped += 1;
      continue;
    }

    const consignee = findConsigneeByCode(consignees, row.consignee);
    if (!consignee) {
      console.warn(
        `skip: consignee not found "${row.consignee}" (shipper ${row.shipper})`
      );
      stats.skipped += 1;
      continue;
    }

    const paymentMode = mapPaymentMode(row.mode);
    const existing = await prisma.paymentRelation.findUnique({
      where: {
        shipperId_consigneeId: {
          shipperId: shipper.id,
          consigneeId: consignee.id,
        },
      },
      select: { id: true },
    });

    await prisma.paymentRelation.upsert({
      where: {
        shipperId_consigneeId: {
          shipperId: shipper.id,
          consigneeId: consignee.id,
        },
      },
      create: {
        shipperId: shipper.id,
        consigneeId: consignee.id,
        paymentMode,
      },
      update: { paymentMode },
    });

    if (existing) stats.updated += 1;
    else stats.inserted += 1;

    console.log(
      `  ok: ${row.shipper} → ${row.consignee} (mode ${paymentMode})`
    );
  }

  const total = await prisma.paymentRelation.count();
  console.log("\n=== Import Results ===");
  console.log(
    `inserted=${stats.inserted}, updated=${stats.updated}, skipped=${stats.skipped}, total=${total}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
