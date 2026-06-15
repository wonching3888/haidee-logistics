import "dotenv/config";
import { prisma } from "@/lib/prisma";

const CONSIGNEE_CODE = "3000-P001";
const STALL_CODE = "MC65";
const NEW_NAME = "MC IS14";

async function main() {
  const before = await prisma.stall.findMany({
    where: {
      code: STALL_CODE,
      consignee: { code: CONSIGNEE_CODE },
      market: { code: "MC" },
    },
    select: {
      id: true,
      code: true,
      name: true,
      market: { select: { code: true } },
      consignee: { select: { code: true, name: true } },
    },
  });
  console.log("Before:", JSON.stringify(before, null, 2));

  const result = await prisma.stall.updateMany({
    where: {
      code: STALL_CODE,
      consignee: { code: CONSIGNEE_CODE },
      market: { code: "MC" },
    },
    data: { name: NEW_NAME },
  });
  console.log(`Updated ${result.count} stall(s)`);

  const after = await prisma.stall.findMany({
    where: {
      code: STALL_CODE,
      consignee: { code: CONSIGNEE_CODE },
      market: { code: "MC" },
    },
    select: {
      id: true,
      code: true,
      name: true,
      market: { select: { code: true } },
      consignee: { select: { code: true, name: true } },
    },
  });
  console.log("After:", JSON.stringify(after, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
