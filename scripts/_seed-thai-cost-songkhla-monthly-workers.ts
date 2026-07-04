/**
 * Seed Songkhla monthly workers SAMRAN (P.TOY) / PRATHUENG (no allowances).
 * Run: npx tsx --env-file=.env.local scripts/_seed-thai-cost-songkhla-monthly-workers.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";

const WORKERS = [
  { name: "SAMRAN (P.TOY)", monthlyWage: 20000 },
  { name: "PRATHUENG", monthlyWage: 15000 },
] as const;

async function main() {
  for (const w of WORKERS) {
    const existing = await prisma.thaiMonthlyWorker.findFirst({
      where: { name: w.name, station: "SONGKHLA" },
    });
    const data = {
      monthlyWage: w.monthlyWage,
      lunchAllowance: 0,
      fuelAllowance: 0,
      rentRoomAllowance: 0,
      active: true,
    };
    if (existing) {
      await prisma.thaiMonthlyWorker.update({
        where: { id: existing.id },
        data,
      });
      console.log(`UPDATE ${w.name} wage=${w.monthlyWage} allowances=0`);
    } else {
      await prisma.thaiMonthlyWorker.create({
        data: {
          id: randomUUID(),
          name: w.name,
          station: "SONGKHLA",
          ...data,
        },
      });
      console.log(`CREATE ${w.name} wage=${w.monthlyWage} allowances=0`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
