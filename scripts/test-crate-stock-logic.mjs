/**
 * Verifies crate stock linkage:
 * 1. Inbound → customer -qty, SADAO unchanged
 * 2. Crate import arrived → SADAO +qty, customer unchanged
 * 3. Crate export → SADAO -qty, customer +qty
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getSadaoStockByTongType } from "../lib/tong.ts";
import {
  addCustomerCrate,
  deductCustomerCrate,
} from "../app/actions/customerCrateStock.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function getCustomerQty(shipperId, crateTypeId) {
  const row = await prisma.customerCrateStock.findUnique({
    where: { shipperId_crateTypeId: { shipperId, crateTypeId } },
  });
  return row?.quantity ?? 0;
}

async function main() {
  const shipper =
    (await prisma.shipper.findFirst({
      where: { OR: [{ name: { contains: "C P", mode: "insensitive" } }, { code: { contains: "CP" } }] },
    })) ??
    (await prisma.shipper.findFirst({ where: { active: true } }));

  const abb = await prisma.tongType.findUnique({ where: { code: "ABB" } });
  const truck = await prisma.truck.findFirst({ where: { active: true } });
  const market = await prisma.market.findFirst({ where: { active: true } });

  if (!shipper || !abb || !truck || !market) {
    throw new Error("Missing test data (shipper/ABB/truck/market)");
  }

  const testDate = new Date("2099-01-15");
  const tag = `test-crate-logic-${Date.now()}`;

  const s0 = (await getSadaoStockByTongType()).ABB?.stock ?? 0;
  const c0 = await getCustomerQty(shipper.id, abb.id);

  // Test 1: inbound deduction
  await deductCustomerCrate(shipper.id, abb.id, 10, "inbound", tag);
  const s1 = (await getSadaoStockByTongType()).ABB?.stock ?? 0;
  const c1 = await getCustomerQty(shipper.id, abb.id);
  console.log("Test1 inbound -10 customer:", c1 === c0 - 10 ? "PASS" : `FAIL (${c0}->${c1})`);
  console.log("Test1 SADAO unchanged:", s1 === s0 ? "PASS" : `FAIL (${s0}->${s1})`);

  // Test 2: crate import +8 SADAO
  await prisma.tongImport.create({
    data: {
      date: testDate,
      truckId: truck.id,
      marketId: market.id,
      tongTypeId: abb.id,
      quantity: 8,
      status: "arrived",
      arrivedAt: new Date(),
      notes: tag,
    },
  });
  const s2 = (await getSadaoStockByTongType()).ABB?.stock ?? 0;
  const c2 = await getCustomerQty(shipper.id, abb.id);
  console.log("Test2 import +8 SADAO:", s2 === s1 + 8 ? "PASS" : `FAIL (${s1}->${s2})`);
  console.log("Test2 customer unchanged:", c2 === c1 ? "PASS" : `FAIL (${c1}->${c2})`);

  // Test 3: crate export -5 SADAO, +5 customer
  await prisma.tongExport.create({
    data: {
      date: testDate,
      thVehiclePlate: "TEST-PLATE",
      shipperId: shipper.id,
      tongTypeId: abb.id,
      quantitySuggested: 5,
      quantityActual: 5,
      shortage: 0,
      notes: tag,
    },
  });
  await addCustomerCrate(shipper.id, abb.id, 5, "export", tag);
  const s3 = (await getSadaoStockByTongType()).ABB?.stock ?? 0;
  const c3 = await getCustomerQty(shipper.id, abb.id);
  console.log("Test3 export -5 SADAO:", s3 === s2 - 5 ? "PASS" : `FAIL (${s2}->${s3})`);
  console.log("Test3 customer +5:", c3 === c2 + 5 ? "PASS" : `FAIL (${c2}->${c3})`);

  // Cleanup test records
  await prisma.tongImport.deleteMany({ where: { notes: tag } });
  await prisma.tongExport.deleteMany({ where: { notes: tag } });
  await prisma.customerCrateLedger.deleteMany({ where: { notes: tag } });
  // Restore customer stock net: -10 +5 = -5 from test
  await prisma.customerCrateStock.upsert({
    where: { shipperId_crateTypeId: { shipperId: shipper.id, crateTypeId: abb.id } },
    create: { shipperId: shipper.id, crateTypeId: abb.id, quantity: c0 },
    update: { quantity: c0 },
  });

  console.log("Cleanup done. Shipper:", shipper.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
