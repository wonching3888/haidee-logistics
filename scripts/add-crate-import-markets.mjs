import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const MARKETS = [
  { code: "ABIBA", name: "ABIBA" },
  { code: "ALPS", name: "ALPS" },
  { code: "ECONSAVE", name: "ECONSAVE" },
  { code: "OTHERS", name: "OTHERS" },
];

for (const market of MARKETS) {
  await prisma.market.upsert({
    where: { code: market.code },
    update: { name: market.name, active: true },
    create: { ...market, active: true },
  });
  console.log(`  ✓ ${market.code}`);
}

await prisma.$disconnect();
