/**
 * Seed Sadao June 2026 Thai cost master data (idempotent).
 *
 * - 3 monthly workers with wage + LUNCH/FUEL/RENT ROOM
 * - Daily-labor roster = 21 (PDF original; clerk may adjust later)
 *
 * Run: npx tsx --env-file=.env.local scripts/_seed-thai-cost-sadao-june-2026.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "crypto";
import {
  SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT,
  SADAO_JUNE_2026_DAILY_LABOR_ROSTER_SOURCE,
  SADAO_JUNE_2026_MONTHLY_WORKERS,
  yearMonthKey,
} from "../lib/constants/thai-cost";
import { prisma } from "../lib/prisma";

async function main() {
  // Deactivate old placeholder SOMRAK-only row names that are not in the PDF list
  // (keep if name matches; update allowances).
  const keepNames = new Set(
    SADAO_JUNE_2026_MONTHLY_WORKERS.map((w) => w.name)
  );

  for (const w of SADAO_JUNE_2026_MONTHLY_WORKERS) {
    const existing = await prisma.thaiMonthlyWorker.findFirst({
      where: { name: w.name, station: "SADAO" },
    });

    const data = {
      monthlyWage: w.monthlyWage,
      lunchAllowance: w.lunchAllowance,
      fuelAllowance: w.fuelAllowance,
      rentRoomAllowance: w.rentRoomAllowance,
      active: true,
    };

    if (existing) {
      await prisma.thaiMonthlyWorker.update({
        where: { id: existing.id },
        data,
      });
      console.log(
        `UPDATE ${w.name} wage=${w.monthlyWage} lunch=${w.lunchAllowance} fuel=${w.fuelAllowance} rent=${w.rentRoomAllowance}`
      );
    } else {
      await prisma.thaiMonthlyWorker.create({
        data: {
          id: randomUUID(),
          name: w.name,
          station: "SADAO",
          ...data,
        },
      });
      console.log(
        `CREATE ${w.name} wage=${w.monthlyWage} lunch=${w.lunchAllowance} fuel=${w.fuelAllowance} rent=${w.rentRoomAllowance}`
      );
    }
  }

  // Deactivate any other active SADAO monthly workers not in the verified list
  const others = await prisma.thaiMonthlyWorker.findMany({
    where: { station: "SADAO", active: true },
  });
  for (const o of others) {
    if (!keepNames.has(o.name)) {
      await prisma.thaiMonthlyWorker.update({
        where: { id: o.id },
        data: { active: false },
      });
      console.log(`DEACTIVATE ${o.name} (not in June 2026 PDF list)`);
    }
  }

  const yearMonth = yearMonthKey(2026, 6);
  await prisma.thaiDailyLaborMonthlyRoster.upsert({
    where: {
      yearMonth_station: { yearMonth, station: "SADAO" },
    },
    create: {
      id: randomUUID(),
      yearMonth,
      station: "SADAO",
      rosterCount: SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT,
      notes: SADAO_JUNE_2026_DAILY_LABOR_ROSTER_SOURCE,
    },
    update: {
      rosterCount: SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT,
      notes: SADAO_JUNE_2026_DAILY_LABOR_ROSTER_SOURCE,
    },
  });
  console.log(
    `ROSTER ${yearMonth} SADAO = ${SADAO_JUNE_2026_DAILY_LABOR_ROSTER_COUNT} (${SADAO_JUNE_2026_DAILY_LABOR_ROSTER_SOURCE})`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
