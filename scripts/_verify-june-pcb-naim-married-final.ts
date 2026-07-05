/**
 * Correct Naim → married / spouseWorking=false (effective 2026-03-01 for PCB logic notes).
 * Re-run June 14-driver PCB validation. No production wiring.
 *
 * Run: node --env-file=.env.local --import tsx scripts/_verify-june-pcb-naim-married-final.ts
 */
import {
  derivePcbNeedsReview,
  normalizeSpouseWorking,
} from "@/lib/driver-pcb-profile";
import {
  advancePcbYearToDate,
  calculateMonthlyPcb,
  emptyPcbYearToDate,
  roundToSen,
  type PcbYearToDate,
} from "@/lib/pcb-calculation";
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

/** Current master profile for June+ (after Naim correction). */
const PROFILE: Record<
  string,
  {
    maritalStatus: "single" | "married";
    spouseWorking: boolean | null;
    childCount: number;
    category: 1 | 2 | 3;
  }
> = {
  Din: { maritalStatus: "single", spouseWorking: null, childCount: 0, category: 1 },
  Naim: { maritalStatus: "married", spouseWorking: false, childCount: 0, category: 2 },
  Akim: { maritalStatus: "married", spouseWorking: true, childCount: 2, category: 3 },
  Azhar: { maritalStatus: "married", spouseWorking: true, childCount: 3, category: 3 },
  Awang: { maritalStatus: "married", spouseWorking: false, childCount: 2, category: 2 },
  Azrin: { maritalStatus: "married", spouseWorking: false, childCount: 4, category: 2 },
  Faizal: { maritalStatus: "married", spouseWorking: false, childCount: 3, category: 2 },
  Fook: { maritalStatus: "married", spouseWorking: false, childCount: 0, category: 2 },
  Halim: { maritalStatus: "married", spouseWorking: false, childCount: 2, category: 2 },
  Ikmal: { maritalStatus: "married", spouseWorking: false, childCount: 2, category: 2 },
  Own: { maritalStatus: "married", spouseWorking: false, childCount: 1, category: 2 },
  Pinat: { maritalStatus: "married", spouseWorking: false, childCount: 3, category: 2 },
  Rozaime: { maritalStatus: "married", spouseWorking: false, childCount: 4, category: 2 },
  Wan: { maritalStatus: "married", spouseWorking: false, childCount: 4, category: 2 },
};

const ACCOUNTING: Record<string, number> = {
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

function money(n: number) {
  return n.toFixed(2);
}

function rollOpening(name: string): PcbYearToDate {
  let ytd = emptyPcbYearToDate();
  const hist = HISTORY[name]!;
  for (const m of [1, 2, 3, 4, 5] as const) {
    const row = hist[m];
    if (!row) continue;
    // Historical PCB as actually paid (no restatement).
    ytd = advancePcbYearToDate(ytd, {
      grossSalary: row.y,
      epfEmployee: row.k,
      pcb: row.x,
    });
  }
  return ytd;
}

async function correctNaim() {
  console.log("=== Correct Naim profile (June+ only; no Jan–May PCB restatement) ===\n");
  console.log("Note: marital change effective 2026-03-01 (user-confirmed); master stores current status only.\n");

  const naim = await prisma.driver.findFirstOrThrow({
    where: { name: "Naim" },
    select: {
      id: true,
      maritalStatus: true,
      spouseWorking: true,
      pcbNeedsReview: true,
      childCount: true,
    },
  });

  const maritalStatus = "married";
  const spouseWorking = normalizeSpouseWorking({
    maritalStatus,
    spouseWorking: false,
  });
  const pcbNeedsReview = derivePcbNeedsReview({
    maritalStatus,
    spouseWorking,
  });

  await prisma.driver.update({
    where: { id: naim.id },
    data: { maritalStatus, spouseWorking, pcbNeedsReview },
  });

  const after = await prisma.driver.findFirstOrThrow({
    where: { id: naim.id },
    select: {
      maritalStatus: true,
      spouseWorking: true,
      pcbNeedsReview: true,
      childCount: true,
    },
  });

  console.log(
    `Naim: marital ${naim.maritalStatus} → ${after.maritalStatus}, spouse ${naim.spouseWorking} → ${after.spouseWorking}, pcbNeedsReview ${naim.pcbNeedsReview} → ${after.pcbNeedsReview}, children=${after.childCount}`
  );

  if (
    after.maritalStatus !== "married" ||
    after.spouseWorking !== false ||
    after.pcbNeedsReview !== false
  ) {
    throw new Error("Naim profile update failed validation");
  }
}

async function validateJune() {
  console.log("\n=== June 2026 PCB final validation (14 drivers) ===\n");

  const dbDrivers = await prisma.driver.findMany({
    where: { name: { in: Object.keys(PROFILE) } },
    select: {
      name: true,
      maritalStatus: true,
      spouseWorking: true,
      childCount: true,
      pcbNeedsReview: true,
    },
  });
  for (const d of dbDrivers) {
    const exp = PROFILE[d.name]!;
    if (
      d.maritalStatus !== exp.maritalStatus ||
      d.spouseWorking !== exp.spouseWorking ||
      d.childCount !== exp.childCount ||
      d.pcbNeedsReview !== false
    ) {
      console.log(
        `WARN ${d.name}: DB marital=${d.maritalStatus} spouse=${d.spouseWorking} children=${d.childCount} review=${d.pcbNeedsReview}`
      );
    }
  }

  type Row = {
    name: string;
    category: number;
    engine: number;
    acct: number;
    delta: number;
    bucket: "exact" | "near" | "manual";
  };
  const rows: Row[] = [];

  for (const name of Object.keys(PROFILE).sort()) {
    const profile = PROFILE[name]!;
    const june = JUNE[name]!;
    const opening = rollOpening(name);
    const result = calculateMonthlyPcb({
      grossSalary: june.gross,
      epfEmployee: june.epfEmployee,
      maritalStatus: profile.maritalStatus,
      spouseWorking: profile.spouseWorking,
      childCount: profile.childCount,
      month: 6,
      accumulatedGrossY: opening.accumulatedGrossY,
      accumulatedEpfK: opening.accumulatedEpfK,
      accumulatedMtdX: opening.accumulatedMtdX,
      pcbMaritalDataVerified: true,
    });

    if (result.profile.category !== profile.category) {
      throw new Error(
        `${name}: expected cat ${profile.category}, got ${result.profile.category}`
      );
    }

    const acct = ACCOUNTING[name] ?? 0;
    const delta = roundToSen(result.pcb - acct);
    let bucket: Row["bucket"] = "exact";
    if (name === "Wan") bucket = "manual";
    else if (Math.abs(delta) >= 0.005) bucket = "near";

    rows.push({
      name,
      category: result.profile.category,
      engine: result.pcb,
      acct,
      delta,
      bucket,
    });
  }

  console.log(
    [
      "name".padEnd(10),
      "cat".padStart(3),
      "engine".padStart(8),
      "acct".padStart(8),
      "Δ".padStart(8),
      "bucket",
    ].join(" ")
  );
  for (const r of rows) {
    console.log(
      [
        r.name.padEnd(10),
        String(r.category).padStart(3),
        money(r.engine).padStart(8),
        money(r.acct).padStart(8),
        money(r.delta).padStart(8),
        r.bucket,
      ].join(" ")
    );
  }

  const exact = rows.filter((r) => r.bucket === "exact");
  const near = rows.filter((r) => r.bucket === "near");
  const manual = rows.filter((r) => r.bucket === "manual");

  console.log("\n=== Summary buckets ===");
  console.log(
    `精确匹配 (${exact.length}): ${exact.map((r) => r.name).join(", ")}`
  );
  console.log(
    `小额尾差 (${near.length}): ${near.map((r) => `${r.name} Δ${money(r.delta)}`).join(", ") || "none"}`
  );
  console.log(
    `待人工核实 (${manual.length}): ${manual.map((r) => `${r.name} Δ${money(r.delta)}`).join(", ")}`
  );

  const naim = rows.find((r) => r.name === "Naim")!;
  console.log(
    `\nNaim check: engine=${money(naim.engine)} acct=${money(naim.acct)} Δ=${money(naim.delta)} (expect exact or near ≤0.55)`
  );
}

async function main() {
  await correctNaim();
  await validateJune();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
