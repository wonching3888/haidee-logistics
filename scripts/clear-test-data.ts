import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const TEST_SHIPPER_NAMES = ["测试商家A"];
const TEST_SHIPPER_CODES = ["S_TEST"];
const TEST_DRIVER = "测试司机";
const TEST_TH_PLATE = "70-TEST1";
const TEST_STALL_CODE = "T01";

async function main() {
  const shippers = await prisma.shipper.findMany({
    where: {
      OR: [
        { name: { in: TEST_SHIPPER_NAMES } },
        { code: { in: TEST_SHIPPER_CODES } },
      ],
    },
    select: { id: true, name: true, code: true },
  });

  const shipperIds = shippers.map((s) => s.id);
  console.log(`Found ${shippers.length} test shipper(s):`, shippers);

  if (shipperIds.length > 0) {
    const sessions = await prisma.inboundSession.findMany({
      where: { shipperId: { in: shipperIds } },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);

    if (sessionIds.length > 0) {
      const lines = await prisma.inboundLine.findMany({
        where: { sessionId: { in: sessionIds } },
        select: { id: true },
      });
      const lineIds = lines.map((l) => l.id);

      const dl = await prisma.dispatchLine.deleteMany({
        where: { inboundLineId: { in: lineIds } },
      });
      const il = await prisma.inboundLine.deleteMany({
        where: { id: { in: lineIds } },
      });
      const is = await prisma.inboundSession.deleteMany({
        where: { id: { in: sessionIds } },
      });
      console.log(`  inbound: ${is.count} sessions, ${il.count} lines, ${dl.count} dispatch links`);
    }

    const te = await prisma.tongExport.deleteMany({
      where: { shipperId: { in: shipperIds } },
    });
    console.log(`  tong_exports: ${te.count}`);

    await prisma.shipperStallDefault.deleteMany({
      where: { shipperId: { in: shipperIds } },
    });
    await prisma.freightRate.deleteMany({
      where: { shipperId: { in: shipperIds } },
    });
  }

  const testDispatches = await prisma.dispatchOrder.findMany({
    where: { driverName: TEST_DRIVER },
    select: { id: true },
  });
  if (testDispatches.length > 0) {
    const ids = testDispatches.map((d) => d.id);
    const dl = await prisma.dispatchLine.deleteMany({
      where: { dispatchOrderId: { in: ids } },
    });
    const d = await prisma.dispatchOrder.deleteMany({ where: { id: { in: ids } } });
    console.log(`  dispatch_orders: ${d.count}, dispatch_lines: ${dl.count}`);
  }

  await prisma.thVehicle.deleteMany({
    where: { plate: TEST_TH_PLATE },
  });

  const kl = await prisma.market.findFirst({ where: { code: "KL" } });
  if (kl && shipperIds.length > 0) {
    const stall = await prisma.stall.findFirst({
      where: { code: TEST_STALL_CODE, marketId: kl.id },
    });
    if (stall) {
      const otherDefaults = await prisma.shipperStallDefault.count({
        where: { stallId: stall.id, shipperId: { notIn: shipperIds } },
      });
      const otherLines = await prisma.inboundLine.count({
        where: { stallId: stall.id },
      });
      if (otherDefaults === 0 && otherLines === 0) {
        await prisma.stall.delete({ where: { id: stall.id } });
        console.log(`  deleted test stall ${TEST_STALL_CODE}`);
      }
    }
  }

  if (shipperIds.length > 0) {
    const s = await prisma.shipper.deleteMany({
      where: { id: { in: shipperIds } },
    });
    console.log(`  shippers: ${s.count}`);
  }

  // Remove batch-6 tong import rows (truck-based, no shipper link)
  const today = new Date();
  const dateOnly = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const ti = await prisma.tongImport.deleteMany({ where: { date: dateOnly } });
  console.log(`  tong_imports (today): ${ti.count}`);

  console.log("Test data cleared.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
