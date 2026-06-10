import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

await prisma.tongType.updateMany({
  where: { code: "BOX" },
  data: { isBox: true, trackInventory: false },
});

const box = await prisma.tongType.findUnique({ where: { code: "BOX" } });
console.log("BOX isBox:", box?.isBox, "trackInventory:", box?.trackInventory);

await prisma.$disconnect();
