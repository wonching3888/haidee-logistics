import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local" });
config();

const MARKET_ORDER = [
  "KL",
  "BP",
  "MP",
  "SL",
  "MC",
  "A",
  "BM",
  "P",
  "TP",
  "NT",
  "KT",
  "SA",
  "KD",
  "JB",
  "OTHER",
];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

await prisma.market.upsert({
  where: { code: "OTHER" },
  update: { name: "OTHER", active: true, displayOrder: 15 },
  create: { code: "OTHER", name: "OTHER", active: true, displayOrder: 15 },
});
console.log("  ✓ OTHER market");

for (const [index, code] of MARKET_ORDER.entries()) {
  const count = await prisma.market.updateMany({
    where: { code },
    data: { displayOrder: index + 1 },
  });
  if (count.count > 0) {
    console.log(`  ✓ display_order ${index + 1} — ${code}`);
  }
}

await prisma.$disconnect();
