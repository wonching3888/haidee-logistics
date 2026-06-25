import { prisma } from "../lib/prisma";

async function main() {
  const rows = await prisma.driverVoucher.findMany({
    orderBy: { createdAt: "asc" },
  });
  for (const v of rows) {
    console.log(JSON.stringify(v, null, 2));
  }
}

main()
  .finally(() => prisma.$disconnect());
