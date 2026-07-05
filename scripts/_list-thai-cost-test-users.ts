/**
 * List clerk / thai_accounting users (roles only, no secrets).
 * Run: npx tsx --env-file=.env.local scripts/_list-thai-cost-test-users.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["clerk", "thai_accounting"] }, active: true },
    select: { email: true, role: true, name: true, language: true },
    orderBy: { email: "asc" },
  });
  console.log(JSON.stringify(users, null, 2));
  console.log("count:", users.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
