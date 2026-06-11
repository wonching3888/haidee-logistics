/**
 * Migrate tong_types: GSK→GKS, merge BHR variants, add Ban Heng/Sahasin/Other.
 * Run: node scripts/migrate-crate-types.mjs
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const OLD_BHR_CODES = ["HD_BHR", "BH_BHR", "LYS_BHR"];

async function getType(code) {
  return prisma.tongType.findUnique({ where: { code } });
}

async function mergeCustomerStockToBhr(bhrId, oldIds) {
  const allIds = [...oldIds, bhrId];
  const rows = await prisma.customerCrateStock.findMany({
    where: { crateTypeId: { in: allIds } },
  });
  if (rows.length === 0) return;

  const merged = new Map();
  for (const row of rows) {
    const key = `${row.shipperId}\0${row.location}`;
    const prev = merged.get(key) ?? {
      shipperId: row.shipperId,
      location: row.location,
      quantity: 0,
    };
    prev.quantity += row.quantity;
    merged.set(key, prev);
  }

  await prisma.customerCrateStock.deleteMany({
    where: { crateTypeId: { in: allIds } },
  });

  for (const entry of merged.values()) {
    await prisma.customerCrateStock.create({
      data: {
        shipperId: entry.shipperId,
        crateTypeId: bhrId,
        location: entry.location,
        quantity: entry.quantity,
      },
    });
  }
}

async function main() {
  // 1. GSK → GKS
  const gsk = await getType("GSK");
  if (gsk) {
    await prisma.tongType.update({
      where: { id: gsk.id },
      data: { code: "GKS", name: "GKS" },
    });
    console.log("✓ GSK renamed to GKS");
  } else {
    const gks = await getType("GKS");
    console.log(gks ? "✓ GKS already exists" : "— GSK/GKS not found, skipped");
  }

  // 2. Ensure BHR exists
  let bhr = await getType("BHR");
  if (!bhr) {
    bhr = await prisma.tongType.create({
      data: {
        code: "BHR",
        name: "BHR",
        trackInventory: true,
        isBox: false,
        displayOrder: 10,
      },
    });
    console.log("✓ Created BHR");
  } else {
    console.log("✓ BHR already exists");
  }

  const oldBhrTypes = await prisma.tongType.findMany({
    where: { code: { in: OLD_BHR_CODES } },
  });
  const oldIds = oldBhrTypes.map((t) => t.id);

  if (oldIds.length > 0) {
    await prisma.inboundLine.updateMany({
      where: { tongTypeId: { in: oldIds } },
      data: { tongTypeId: bhr.id },
    });
    await prisma.inboundLine.updateMany({
      where: { originalTongTypeId: { in: oldIds } },
      data: { originalTongTypeId: bhr.id },
    });
    await prisma.tongImport.updateMany({
      where: { tongTypeId: { in: oldIds } },
      data: { tongTypeId: bhr.id },
    });
    await prisma.tongExport.updateMany({
      where: { tongTypeId: { in: oldIds } },
      data: { tongTypeId: bhr.id },
    });
    await prisma.shipper.updateMany({
      where: { defaultTongTypeId: { in: oldIds } },
      data: { defaultTongTypeId: bhr.id },
    });
    await prisma.shipperStallDefault.updateMany({
      where: { tongTypeId: { in: oldIds } },
      data: { tongTypeId: bhr.id },
    });
    await prisma.customerCrateLedger.updateMany({
      where: { crateTypeId: { in: oldIds } },
      data: { crateTypeId: bhr.id },
    });

    await mergeCustomerStockToBhr(bhr.id, oldIds);

    await prisma.tongType.deleteMany({
      where: { code: { in: OLD_BHR_CODES } },
    });
    console.log(`✓ Merged and removed ${OLD_BHR_CODES.join(", ")}`);
  } else {
    console.log("✓ No old BHR variants to merge");
  }

  // 3. Add new types
  const newTypes = [
    {
      code: "BAN_HENG",
      name: "Ban Heng",
      trackInventory: true,
      displayOrder: 14,
    },
    {
      code: "SAHASIN",
      name: "Sahasin",
      trackInventory: true,
      displayOrder: 15,
    },
    {
      code: "OTHER",
      name: "Other",
      trackInventory: false,
      displayOrder: 16,
    },
  ];

  for (const t of newTypes) {
    await prisma.tongType.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        trackInventory: t.trackInventory,
        displayOrder: t.displayOrder,
      },
      create: { ...t, isBox: false },
    });
    console.log(`✓ Upserted ${t.code}`);
  }

  // Verify
  const all = await prisma.tongType.findMany({
    where: {
      code: {
        in: [
          "GKS",
          "BHR",
          "BAN_HENG",
          "SAHASIN",
          "OTHER",
          ...OLD_BHR_CODES,
        ],
      },
    },
    select: { code: true, name: true, trackInventory: true },
    orderBy: { code: "asc" },
  });
  console.log("\nVerification:");
  for (const t of all) {
    console.log(`  ${t.code} — ${t.name} (track=${t.trackInventory})`);
  }
  const stale = all.filter((t) => OLD_BHR_CODES.includes(t.code));
  if (stale.length > 0) {
    throw new Error(`Old BHR codes still present: ${stale.map((t) => t.code).join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
