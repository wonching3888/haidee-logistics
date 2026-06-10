import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SHIPPER_CODE = "S_TEST";
const TH_PLATE = "70-TEST1";
const IMPORT_QTY = 20;
const EXPORT_QTY = 15;
const TONG_CODE = "ABB";

async function main() {
  const now = new Date();
  const dateOnly = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );

  const shipper = await prisma.shipper.findUnique({ where: { code: SHIPPER_CODE } });
  if (!shipper) throw new Error("Run setup-test-shipper.ts first");

  await prisma.thVehicle.upsert({
    where: { plate: TH_PLATE },
    update: { shipperId: shipper.id, active: true },
    create: { plate: TH_PLATE, shipperId: shipper.id, active: true },
  });

  const tongType = await prisma.tongType.findFirst({ where: { code: TONG_CODE } });
  if (!tongType) throw new Error("ABB tong type missing");

  await prisma.tongExport.deleteMany({
    where: { shipperId: shipper.id, date: dateOnly },
  });
  await prisma.tongImport.deleteMany({ where: { date: dateOnly } });

  const truck = await prisma.truck.findFirst({ where: { active: true } });
  const market = await prisma.market.findFirst({ where: { code: "KL" } });
  if (!truck || !market) throw new Error("Missing truck or KL market");

  console.log(
    JSON.stringify({
      shipperId: shipper.id,
      shipperName: shipper.name,
      thPlate: TH_PLATE,
      truckPlate: truck.plate,
      tongCode: TONG_CODE,
      importQty: IMPORT_QTY,
      exportQty: EXPORT_QTY,
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
