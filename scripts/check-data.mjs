import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const shippers = await prisma.shipper.findMany({
  select: { id: true, code: true, name: true },
});
console.log("Shippers:", shippers);

const thaiTong = shippers.find((s) => s.name === "THAI TONG");
if (thaiTong) {
  const stalls = await prisma.shipperStallDefault.findMany({
    where: { shipperId: thaiTong.id },
    include: { stall: { include: { market: true } }, tongType: true },
  });
  console.log(
    "THAI TONG stalls:",
    stalls.map((d) => ({
      code: d.stall.code,
      market: d.stall.market?.code,
      tong: d.tongType.code,
    }))
  );
}

await prisma.$disconnect();
