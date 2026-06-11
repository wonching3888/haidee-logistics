/**
 * Rename BAN_HENG → BH, SAHASIN → SHS
 * Run: node scripts/rename-crate-types-bh-shs.mjs
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const RENAMES = [
  { from: "BAN_HENG", to: "BH", name: "BH" },
  { from: "SAHASIN", to: "SHS", name: "SHS" },
];

async function main() {
  for (const { from, to, name } of RENAMES) {
    const existing = await prisma.tongType.findUnique({ where: { code: from } });
    if (existing) {
      await prisma.tongType.update({
        where: { id: existing.id },
        data: { code: to, name },
      });
      console.log(`✓ ${from} → ${to}`);
    } else {
      const target = await prisma.tongType.findUnique({ where: { code: to } });
      console.log(target ? `✓ ${to} already exists` : `— ${from} not found`);
    }
  }

  const codes = await prisma.tongType.findMany({
    where: { code: { in: ["BH", "SHS", "BAN_HENG", "SAHASIN"] } },
    select: { code: true, name: true },
    orderBy: { code: "asc" },
  });
  console.log("\nVerification:", codes);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
