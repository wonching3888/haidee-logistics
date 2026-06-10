import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SHIPPER_CODE = "S_TEST";
const SHIPPER_NAME = "测试商家A";
const STALL_CODE = "T01";

async function main() {
  const abb = await prisma.tongType.findFirst({ where: { code: "ABB" } });
  const kl = await prisma.market.findFirst({ where: { code: "KL" } });
  if (!abb || !kl) throw new Error("Missing seed data (ABB tong type or KL market)");

  const shipper = await prisma.shipper.upsert({
    where: { code: SHIPPER_CODE },
    update: { name: SHIPPER_NAME, active: true },
    create: {
      code: SHIPPER_CODE,
      name: SHIPPER_NAME,
      defaultTongTypeId: abb.id,
      active: true,
    },
  });

  let stall = await prisma.stall.findFirst({
    where: { code: STALL_CODE, marketId: kl.id },
  });
  if (!stall) {
    stall = await prisma.stall.create({
      data: { code: STALL_CODE, marketId: kl.id, name: "Test Stall" },
    });
  }

  await prisma.shipperStallDefault.upsert({
    where: { shipperId_stallId: { shipperId: shipper.id, stallId: stall.id } },
    update: { tongTypeId: abb.id },
    create: { shipperId: shipper.id, stallId: stall.id, tongTypeId: abb.id },
  });

  // Reset test inbound/dispatch so flow test is idempotent
  const testSessions = await prisma.inboundSession.findMany({
    where: { shipperId: shipper.id },
    select: { id: true },
  });
  if (testSessions.length > 0) {
    const sessionIds = testSessions.map((s) => s.id);
    await prisma.dispatchLine.deleteMany({
      where: { inboundLine: { sessionId: { in: sessionIds } } },
    });
    await prisma.inboundLine.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.inboundSession.deleteMany({ where: { id: { in: sessionIds } } });
  }
  const testDispatches = await prisma.dispatchOrder.findMany({
    where: { driverName: "测试司机" },
    select: { id: true },
  });
  if (testDispatches.length > 0) {
    const ids = testDispatches.map((d) => d.id);
    await prisma.dispatchLine.deleteMany({ where: { dispatchOrderId: { in: ids } } });
    await prisma.dispatchOrder.deleteMany({ where: { id: { in: ids } } });
  }

  console.log(JSON.stringify({ shipperId: shipper.id, shipperName: shipper.name, marketCode: "KL" }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
