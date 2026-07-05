/**
 * Seed driver_pcb_ytd_balances as of 2026-06 (opening for July auto PCB).
 * Uses Jan–May history + June rev7 gross/EPF + June accounting PCB (no restatement).
 *
 * Run: node --env-file=.env.local --import tsx scripts/_seed-pcb-ytd-end-of-june-2026.ts
 */
import { advancePcbYearToDate, emptyPcbYearToDate } from "@/lib/pcb-calculation";
import { upsertPcbYtdBalance } from "@/lib/pcb-ytd-balance";
import { prisma } from "@/lib/prisma";

type MonthRow = { y: number; k: number; x: number };

const HISTORY: Record<string, Partial<Record<1 | 2 | 3 | 4 | 5, MonthRow>>> = {
  Halim: {
    1: { y: 8260, k: 913, x: 436.9 },
    2: { y: 8050, k: 891, x: 397.0 },
    3: { y: 9050, k: 1001, x: 587.0 },
    4: { y: 9500, k: 1045, x: 672.5 },
    5: { y: 7800, k: 1014, x: 353.1 },
  },
  Awang: {
    1: { y: 7470, k: 825, x: 295.9 },
    2: { y: 7250, k: 803, x: 271.7 },
    3: { y: 8420, k: 935, x: 463.75 },
    4: { y: 7650, k: 847, x: 317.45 },
    5: { y: 6230, k: 590, x: 151.35 },
  },
  Azrin: {
    1: { y: 8120, k: 902, x: 347.0 },
    2: { y: 7350, k: 814, x: 244.55 },
    3: { y: 6930, k: 770, x: 198.35 },
    4: { y: 6320, k: 704, x: 131.25 },
    5: { y: 5740, k: 638, x: 69.65 },
  },
  Wan: {
    1: { y: 8590, k: 946, x: 436.3 },
    2: { y: 6500, k: 715, x: 147.6 },
    3: { y: 6660, k: 737, x: 165.2 },
    4: { y: 6000, k: 660, x: 92.6 },
    5: { y: 6420, k: 715, x: 138.8 },
  },
  Own: {
    1: { y: 5010, k: 561, x: 80.6 },
    2: { y: 5490, k: 605, x: 109.4 },
    3: { y: 5750, k: 638, x: 125.0 },
    4: { y: 6590, k: 726, x: 211.85 },
    5: { y: 5320, k: 594, x: 94.65 },
  },
  Rozaime: {
    1: { y: 7000, k: 770, x: 207.5 },
    2: { y: 6550, k: 726, x: 158.0 },
    3: { y: 6680, k: 737, x: 172.3 },
    4: { y: 8150, k: 902, x: 334.0 },
    5: { y: 6330, k: 704, x: 133.8 },
  },
  Fook: {
    1: { y: 5430, k: 605, x: 115.8 },
    2: { y: 5280, k: 583, x: 106.8 },
    3: { y: 6050, k: 671, x: 174.05 },
    4: { y: 4890, k: 539, x: 81.1 },
    5: { y: 6470, k: 715, x: 215.95 },
  },
  Faizal: {
    1: { y: 6700, k: 737, x: 192.85 },
    2: { y: 5220, k: 583, x: 70.4 },
    3: { y: 5700, k: 627, x: 99.2 },
    4: { y: 5775, k: 638, x: 103.7 },
    5: { y: 5610, k: 627, x: 93.8 },
  },
  Akim: {
    1: { y: 6360, k: 704, x: 210.45 },
    2: { y: 6270, k: 693, x: 200.55 },
    3: { y: 6320, k: 704, x: 206.05 },
    4: { y: 6810, k: 759, x: 259.95 },
    5: { y: 5840, k: 649, x: 153.25 },
  },
  Naim: {
    1: { y: 7010, k: 781, x: 326.1 },
    2: { y: 6400, k: 704, x: 250.85 },
    3: { y: 4930, k: 544, x: 66.6 },
    4: { y: 6370, k: 704, x: 201.15 },
    5: { y: 7080, k: 781, x: 279.25 },
  },
  Azhar: {
    1: { y: 7550, k: 836, x: 333.7 },
    2: { y: 6330, k: 704, x: 187.85 },
    3: { y: 5340, k: 594, x: 87.55 },
    4: { y: 7000, k: 770, x: 260.6 },
    5: { y: 5780, k: 638, x: 126.4 },
  },
  Pinat: {
    3: { y: 6920, k: 770, x: 127.2 },
    4: { y: 7115, k: 792, x: 138.9 },
    5: { y: 6220, k: 693, x: 85.2 },
  },
  Din: {
    4: { y: 6320, k: 704, x: 125.9 },
    5: { y: 5940, k: 660, x: 103.1 },
  },
  Ikmal: {
    5: { y: 5670, k: 627, x: 0.0 },
  },
};

/** June rev7 gross / EPF employee. */
const JUNE: Record<string, { gross: number; epfEmployee: number }> = {
  Halim: { gross: 3550, epfEmployee: 392 },
  Awang: { gross: 4790, epfEmployee: 528 },
  Azrin: { gross: 4090, epfEmployee: 451 },
  Wan: { gross: 4790, epfEmployee: 528 },
  Own: { gross: 4150, epfEmployee: 458 },
  Rozaime: { gross: 4150, epfEmployee: 458 },
  Fook: { gross: 4510, epfEmployee: 498 },
  Faizal: { gross: 4650, epfEmployee: 513 },
  Akim: { gross: 4630, epfEmployee: 511 },
  Naim: { gross: 4830, epfEmployee: 533 },
  Azhar: { gross: 4730, epfEmployee: 522 },
  Pinat: { gross: 5040, epfEmployee: 561 },
  Din: { gross: 920, epfEmployee: 102 },
  Ikmal: { gross: 4610, epfEmployee: 509 },
};

/** June accounting PCB (rev7 / manual) — do not restate. */
const JUNE_PCB: Record<string, number> = {
  Wan: 11.65,
  Own: 24.45,
  Fook: 52.55,
  Faizal: 36.2,
  Akim: 41.5,
  Naim: 41.75,
  Azhar: 38.65,
  Halim: 0,
  Awang: 0,
  Azrin: 0,
  Rozaime: 0,
  Pinat: 0,
  Din: 0,
  Ikmal: 0,
};

async function main() {
  const drivers = await prisma.driver.findMany({
    where: { name: { in: Object.keys(HISTORY) } },
    select: { id: true, name: true },
  });
  const byName = new Map(drivers.map((d) => [d.name, d.id]));

  console.log("Seeding driver_pcb_ytd_balances asOf=2026-06 (July opening)\n");

  for (const name of Object.keys(HISTORY).sort()) {
    const driverId = byName.get(name);
    if (!driverId) throw new Error(`Driver not found: ${name}`);

    let ytd = emptyPcbYearToDate();
    const hist = HISTORY[name]!;
    for (const m of [1, 2, 3, 4, 5] as const) {
      const row = hist[m];
      if (!row) continue;
      ytd = advancePcbYearToDate(ytd, {
        grossSalary: row.y,
        epfEmployee: row.k,
        pcb: row.x,
      });
    }

    const june = JUNE[name]!;
    const junePcb = JUNE_PCB[name] ?? 0;
    ytd = advancePcbYearToDate(ytd, {
      grossSalary: june.gross,
      epfEmployee: june.epfEmployee,
      pcb: junePcb,
    });

    await upsertPcbYtdBalance({
      driverId,
      asOfYearMonth: "2026-06",
      balance: ytd,
      source: "seed",
    });

    console.log(
      `${name.padEnd(10)} Y=${ytd.accumulatedGrossY.toFixed(2).padStart(10)} K=${ytd.accumulatedEpfK.toFixed(2).padStart(10)} X=${ytd.accumulatedMtdX.toFixed(2).padStart(10)}`
    );
  }

  console.log("\nDone. July auto PCB will read asOfYearMonth=2026-06.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
