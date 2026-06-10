import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SEED_CODES = ["S001", "S002", "S003"];

const SHIPPERS: {
  code: string;
  name: string;
  paymentParty: string;
}[] = [
  { code: "3001-A001", name: "ARSAN FISHERY", paymentParty: "shipper" },
  { code: "3001-A002", name: "AIK HUAT", paymentParty: "shipper" },
  { code: "3001-A003", name: "ANN - RANONG", paymentParty: "shipper" },
  { code: "3001-A004", name: "AR MEI - PATTANI", paymentParty: "shipper" },
  { code: "3001-A005", name: "ARUN - PHUKET", paymentParty: "shipper" },
  { code: "3001-A006", name: "AR MEI - RANONG", paymentParty: "shipper" },
  { code: "3001-A007", name: "ANN - PATTANI", paymentParty: "shipper" },
  { code: "3001-A008", name: "ANYA SEAFOOD", paymentParty: "shipper" },
  { code: "3001-A009", name: "AH HENG FISHERY", paymentParty: "shipper" },
  { code: "3001-A010", name: "AR MUI - PATTANI", paymentParty: "shipper" },
  { code: "3001-B001", name: "BROTHER - PATTANI", paymentParty: "shipper" },
  { code: "3001-B002", name: "BAN HENG TRADING CO LTD", paymentParty: "shipper" },
  { code: "3001-C001", name: "CHALEE FISHERY", paymentParty: "shipper" },
  { code: "3001-C002", name: "CHUN MENG", paymentParty: "shipper" },
  { code: "3001-C003", name: "CH FISHERY", paymentParty: "shipper" },
  { code: "3001-C004", name: "CT - PATTANI", paymentParty: "shipper" },
  { code: "3001-C005", name: "CT - SONGKHLA", paymentParty: "shipper" },
  { code: "3001-C006", name: "C P", paymentParty: "shipper" },
  { code: "3001-C007", name: "CHAH", paymentParty: "shipper" },
  { code: "3001-D001", name: "DING SENG - PATTANI", paymentParty: "shipper" },
  { code: "3001-D002", name: "DOLPHIN", paymentParty: "shipper" },
  { code: "3001-G001", name: "GONG", paymentParty: "shipper" },
  { code: "3001-G002", name: "GUAN - HATYAI", paymentParty: "shipper" },
  { code: "3001-H001", name: "HONG LEE", paymentParty: "shipper" },
  { code: "3001-H002", name: "HAI SENG HUAT", paymentParty: "shipper" },
  { code: "3001-H003", name: "HENG - PHUKET", paymentParty: "shipper" },
  { code: "3001-H004", name: "HENG DEE", paymentParty: "shipper" },
  { code: "3001-H005", name: "HUP HUAT", paymentParty: "shipper" },
  { code: "3001-H006", name: "HONG MENG FISHERY", paymentParty: "shipper" },
  { code: "3001-H007", name: "HUAT SYARIKAT (LIM PTN)", paymentParty: "shipper" },
  { code: "3001-H008", name: "HENG HUAT", paymentParty: "shipper" },
  { code: "3001-H009", name: "HUP DEE TRANSPORT CO LTD", paymentParty: "shipper" },
  { code: "3001-H010", name: "HENG RUNG SAENG CO LTD", paymentParty: "shipper" },
  { code: "3001-K001", name: "KWAN - PHUKET", paymentParty: "shipper" },
  { code: "3001-K002", name: "KH - RANONG", paymentParty: "shipper" },
  { code: "3001-K003", name: "KHOON WENG TRANSPORT LTD", paymentParty: "shipper" },
  { code: "3001-L001", name: "L.A.FISHERY - PHUKET", paymentParty: "shipper" },
  { code: "3001-M001", name: "MEENA", paymentParty: "shipper" },
  { code: "3001-N001", name: "NAI LEAT", paymentParty: "shipper" },
  { code: "3001-N002", name: "NAM SENG", paymentParty: "shipper" },
  { code: "3001-N003", name: "NAI MENG", paymentParty: "shipper" },
  { code: "3001-N004", name: "NY - RANONG", paymentParty: "shipper" },
  { code: "3001-N005", name: "NR FISHERY", paymentParty: "shipper" },
  { code: "3001-N006", name: "NAZAE - PATTANI", paymentParty: "shipper" },
  { code: "3001-P001", name: "PPR - PHUKET", paymentParty: "shipper" },
  { code: "3001-P002", name: "PRANACHAI", paymentParty: "shipper" },
  { code: "3001-P003", name: "PNN", paymentParty: "shipper" },
  { code: "3001-P004", name: "POR - PATTANI", paymentParty: "shipper" },
  { code: "3001-P005", name: "PIN SEA PRODUCT - LAI HUAT", paymentParty: "shipper" },
  { code: "3001-P006", name: "PRIM", paymentParty: "shipper" },
  { code: "3001-P007", name: "PT PHUKET", paymentParty: "shipper" },
  { code: "3001-P008", name: "PPR - SONGKHLA", paymentParty: "shipper" },
  { code: "3001-R001", name: "RB - PATTANI", paymentParty: "shipper" },
  { code: "3001-S001", name: "SENG HUAT - TAKOR", paymentParty: "shipper" },
  { code: "3001-S002", name: "SOON - SONGKHLA", paymentParty: "shipper" },
  { code: "3001-S003", name: "SAHASIN - HY", paymentParty: "shipper" },
  { code: "3001-S004", name: "SOON HENG", paymentParty: "shipper" },
  { code: "3001-S005", name: "SAI - RANONG", paymentParty: "shipper" },
  { code: "3001-S006", name: "SOH - SK", paymentParty: "shipper" },
  { code: "3001-S007", name: "SOMPONG - SK", paymentParty: "shipper" },
  { code: "3001-S008", name: "SAHASIN - SK", paymentParty: "C.O.D." },
  { code: "3001-T001", name: "THAI LAI", paymentParty: "shipper" },
  { code: "3001-T002", name: "TAT KHENG", paymentParty: "shipper" },
  { code: "3001-T003", name: "THAI TONG FISHERY", paymentParty: "shipper" },
  { code: "3001-T004", name: "TUI PATTANI", paymentParty: "shipper" },
  { code: "3001-V001", name: "VP FISHERY", paymentParty: "shipper" },
  { code: "3001-W001", name: "WAN - SONGKHLA", paymentParty: "shipper" },
  { code: "3001-Y001", name: "YIN - SONGKHLA", paymentParty: "shipper" },
  { code: "3001-Y002", name: "Y S", paymentParty: "shipper" },
  { code: "3001-Y003", name: "YUNG SU", paymentParty: "shipper" },
  { code: "3010-S001", name: "SOMPONG (SST)", paymentParty: "C.O.D." },
];

async function deleteSeedShippers() {
  const seeds = await prisma.shipper.findMany({
    where: { code: { in: SEED_CODES } },
    select: { id: true, code: true },
  });
  if (seeds.length === 0) {
    console.log("No seed shippers to delete.");
    return;
  }
  const ids = seeds.map((s) => s.id);

  const sessions = await prisma.inboundSession.findMany({
    where: { shipperId: { in: ids } },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length > 0) {
    const lines = await prisma.inboundLine.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { id: true },
    });
    const lineIds = lines.map((l) => l.id);
    if (lineIds.length > 0) {
      await prisma.dispatchLine.deleteMany({
        where: { inboundLineId: { in: lineIds } },
      });
      await prisma.inboundLine.deleteMany({ where: { id: { in: lineIds } } });
    }
    await prisma.inboundSession.deleteMany({ where: { id: { in: sessionIds } } });
  }

  await prisma.tongExport.deleteMany({ where: { shipperId: { in: ids } } });
  await prisma.shipperStallDefault.deleteMany({ where: { shipperId: { in: ids } } });
  await prisma.freightRate.deleteMany({ where: { shipperId: { in: ids } } });
  await prisma.thVehicle.deleteMany({ where: { shipperId: { in: ids } } });
  const deleted = await prisma.shipper.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${deleted.count} seed shippers: ${seeds.map((s) => s.code).join(", ")}`);
}

async function main() {
  const abb = await prisma.tongType.findUnique({ where: { code: "ABB" } });
  if (!abb) throw new Error("ABB tong type not found — run prisma db seed first");

  await deleteSeedShippers();

  let inserted = 0;
  let skipped = 0;
  for (const s of SHIPPERS) {
    const existing = await prisma.shipper.findUnique({ where: { code: s.code } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.shipper.create({
      data: {
        code: s.code,
        name: s.name,
        defaultTongTypeId: abb.id,
        paymentParty: s.paymentParty,
        company: "haidee",
        active: true,
      },
    });
    inserted++;
  }

  const total = await prisma.shipper.count();
  console.log(`Inserted ${inserted} shippers, skipped ${skipped} existing.`);
  console.log(`Total shippers in database: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
