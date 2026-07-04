/**
 * Update Wan driver fullName only.
 * Run: node --env-file=.env.local --import tsx scripts/_update-wan-fullname-name.ts
 */
import { prisma } from "@/lib/prisma";

const FULL_NAME = "Wan Syafirul Hafiq Bin Wan Mustafa";

async function main() {
  const wan = await prisma.driver.findFirst({
    where: { name: "Wan" },
    select: {
      id: true,
      name: true,
      fullName: true,
      icNumber: true,
      bankName: true,
      bankAccount: true,
    },
  });
  if (!wan) throw new Error("Wan not found");

  console.log("Before:", wan);

  const updated = await prisma.driver.update({
    where: { id: wan.id },
    data: { fullName: FULL_NAME },
    select: {
      id: true,
      name: true,
      fullName: true,
      icNumber: true,
      bankName: true,
      bankAccount: true,
    },
  });

  console.log("After:", updated);

  if (updated.fullName !== FULL_NAME) {
    throw new Error("fullName update failed");
  }
  if (updated.icNumber !== wan.icNumber) {
    throw new Error("icNumber changed unexpectedly");
  }
  if (updated.bankAccount !== wan.bankAccount) {
    throw new Error("bankAccount changed unexpectedly");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
