/**
 * 1) Correct Fook maritalStatus=married, spouseWorking=false
 * 2) Full June PCB validation for 14 drivers vs accounting
 * 3) Wan deep-dive
 *
 * Run: node --env-file=.env.local --import tsx scripts/_verify-june-pcb-final-readonly.ts
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
  roundUpToNearest5Sen,
  truncateToSen,
  type PcbYearToDate,
} from "@/lib/pcb-calculation";
import {
  PCB_CHILD_RELIEF_PER_CHILD,
  PCB_EPF_ANNUAL_CAP,
  PCB_INDIVIDUAL_RELIEF_ANNUAL,
  PCB_SPOUSE_RELIEF_ANNUAL,
  PCB_TAX_BRACKETS_2026,
} from "@/lib/constants/pcb-2026";
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

/** June rev7 anchors (Din base 550). */
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

/** Final confirmed categories. */
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
  Naim: { maritalStatus: "single", spouseWorking: null, childCount: 0, category: 1 },
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
    ytd = advancePcbYearToDate(ytd, {
      grossSalary: row.y,
      epfEmployee: row.k,
      pcb: row.x,
    });
  }
  return ytd;
}

async function correctFook(): Promise<"written" | "offline"> {
  console.log("=== 1. Correct Fook maritalStatus + spouseWorking ===\n");

  const maritalStatus = "married";
  const spouseWorking = normalizeSpouseWorking({
    maritalStatus,
    spouseWorking: false,
  });
  const pcbNeedsReview = derivePcbNeedsReview({
    maritalStatus,
    spouseWorking,
  });

  try {
    const fook = await prisma.driver.findFirstOrThrow({
      where: { name: "Fook" },
      select: {
        id: true,
        maritalStatus: true,
        spouseWorking: true,
        pcbNeedsReview: true,
      },
    });

    await prisma.driver.update({
      where: { id: fook.id },
      data: { maritalStatus, spouseWorking, pcbNeedsReview },
    });

    const after = await prisma.driver.findFirstOrThrow({
      where: { id: fook.id },
      select: {
        maritalStatus: true,
        spouseWorking: true,
        pcbNeedsReview: true,
      },
    });

    console.log(
      `Fook: marital ${fook.maritalStatus} → ${after.maritalStatus}, spouse ${fook.spouseWorking} → ${after.spouseWorking}, pcbNeedsReview ${fook.pcbNeedsReview} → ${after.pcbNeedsReview}`
    );
    if (after.pcbNeedsReview !== false) {
      throw new Error("Fook pcbNeedsReview should be false after correction");
    }
    if (after.maritalStatus !== "married" || after.spouseWorking !== false) {
      throw new Error("Fook profile not updated correctly");
    }
    return "written";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Can't reach database") || msg.includes("P1001")) {
      console.log(
        `DB unreachable — Fook write PENDING. Validation continues with intended profile: marital=married spouseWorking=false pcbNeedsReview=${pcbNeedsReview}`
      );
      return "offline";
    }
    throw err;
  }
}

function explainResidual(input: {
  name: string;
  enginePcb: number;
  accountingPcb: number;
  mtdRawBefore5Sen: number;
  engineP: number;
  opening: PcbYearToDate;
  juneGross: number;
  juneEpf: number;
  category: 1 | 2 | 3;
  childCount: number;
}) {
  const delta = roundToSen(input.enginePcb - input.accountingPcb);
  if (Math.abs(delta) < 0.005) return "exact";

  const toSen = Math.round(input.mtdRawBefore5Sen * 100) / 100;
  const notes: string[] = [];

  // Would half-up to sen (no 5-sen) match accounting?
  if (Math.abs(toSen - input.accountingPcb) < 0.005) {
    notes.push("matches if MTD half-up to sen WITHOUT 5-sen round-up");
  }
  // Would truncate MTD to sen match?
  const truncSen = truncateToSen(input.mtdRawBefore5Sen);
  if (Math.abs(truncSen - input.accountingPcb) < 0.005) {
    notes.push("matches if MTD truncate-to-sen (no 5-sen)");
  }
  // Would 5-sen on slightly different raw match?
  const fromAcct = input.accountingPcb;
  const impliedRawLow = fromAcct - 0.049999;
  const impliedRawHigh = fromAcct;
  if (
    input.mtdRawBefore5Sen > impliedRawLow &&
    input.mtdRawBefore5Sen <= impliedRawHigh + 0.0001
  ) {
    notes.push("raw MTD already in accounting 5-sen bucket");
  }

  // LP sensitivity: how much LP would be needed to hit accounting
  // MTD = [(P-M)*R/100 + B - X] / 7, P decreases by LP
  // For residual investigation print raw vs rounded
  notes.push(
    `mtdRaw=${input.mtdRawBefore5Sen.toFixed(6)} → 5sen=${money(input.enginePcb)} halfUpSen=${money(toSen)}`
  );

  return notes.join("; ");
}

function computeMtdRaw(input: {
  opening: PcbYearToDate;
  juneGross: number;
  juneEpf: number;
  category: 1 | 2 | 3;
  childCount: number;
  lp?: number;
  overrideX?: number;
}) {
  const n = 6;
  const y1 = input.juneGross;
  const k1 = input.juneEpf;
  const yAccum = input.opening.accumulatedGrossY;
  const kAccum = input.opening.accumulatedEpfK;
  const x = input.overrideX ?? input.opening.accumulatedMtdX;
  const lp = input.lp ?? 0;

  const remainingCap = Math.max(0, PCB_EPF_ANNUAL_CAP - kAccum - k1);
  const k2 = Math.min(k1, truncateToSen(remainingCap / n));

  const projected =
    yAccum - kAccum + (y1 - k1) + (y1 - k2) * n;
  const d = PCB_INDIVIDUAL_RELIEF_ANNUAL;
  const s = input.category === 2 ? PCB_SPOUSE_RELIEF_ANNUAL : 0;
  const qc =
    input.category === 1
      ? 0
      : input.childCount * PCB_CHILD_RELIEF_PER_CHILD;
  const P = roundToSen(projected - (d + s + qc + lp));

  const bracket = PCB_TAX_BRACKETS_2026.find((b) => P <= b.maxP)!;
  const bVal =
    input.category === 2 ? bracket.bCat2 : bracket.bCat1And3;
  const mtdRaw =
    ((P - bracket.m) * bracket.r) / 100 + bVal - x;
  const mtdBeforeDiv = mtdRaw;
  const mtd = mtdBeforeDiv / (n + 1);

  return { P, k2, mtdRaw: mtd, mtd5: roundUpToNearest5Sen(Math.max(0, mtd)) };
}

async function runJuneValidation(dbMode: "written" | "offline") {
  console.log("\n=== 2. June PCB full validation (14 drivers) ===\n");

  if (dbMode === "written") {
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
          `WARN profile drift ${d.name}: DB marital=${d.maritalStatus} spouse=${d.spouseWorking} children=${d.childCount} review=${d.pcbNeedsReview}`
        );
      }
    }
  } else {
    console.log(
      "(offline mode: using confirmed PROFILE map, including Fook=married/spouse=false)\n"
    );
  }

  type Row = {
    name: string;
    category: number;
    engine: number;
    acct: number;
    delta: number;
    P: number;
    k2: number;
    mtdRaw: number;
    note: string;
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

    const raw = computeMtdRaw({
      opening,
      juneGross: june.gross,
      juneEpf: june.epfEmployee,
      category: profile.category,
      childCount: profile.childCount,
    });

    const acct = ACCOUNTING[name] ?? 0;
    const delta = roundToSen(result.pcb - acct);
    let note = "exact";
    if (Math.abs(delta) >= 0.005) {
      note = explainResidual({
        name,
        enginePcb: result.pcb,
        accountingPcb: acct,
        mtdRawBefore5Sen: raw.mtdRaw,
        engineP: result.annualChargeableP,
        opening,
        juneGross: june.gross,
        juneEpf: june.epfEmployee,
        category: profile.category,
        childCount: profile.childCount,
      });
    }

    rows.push({
      name,
      category: result.profile.category,
      engine: result.pcb,
      acct,
      delta,
      P: result.annualChargeableP,
      k2: result.k2,
      mtdRaw: raw.mtdRaw,
      note,
    });
  }

  console.log(
    [
      "name".padEnd(10),
      "cat".padStart(3),
      "engine".padStart(8),
      "acct".padStart(8),
      "Δ".padStart(8),
      "status",
    ].join(" ")
  );

  for (const r of rows) {
    const status =
      Math.abs(r.delta) < 0.005
        ? "EXACT"
        : Math.abs(r.delta) <= 0.55
          ? "NEAR"
          : "GAP";
    console.log(
      [
        r.name.padEnd(10),
        String(r.category).padStart(3),
        money(r.engine).padStart(8),
        money(r.acct).padStart(8),
        money(r.delta).padStart(8),
        status,
      ].join(" ")
    );
  }

  console.log("\n--- Residual root-cause notes ---");
  for (const r of rows.filter((x) => Math.abs(x.delta) >= 0.005)) {
    console.log(
      `${r.name}: Δ=${money(r.delta)} P=${money(r.P)} K2=${money(r.k2)} | ${r.note}`
    );

    // LP needed to hit accounting (solve for LP)
    // MTD_acct = [(P0 - LP - M)*R/100 + B - X] / 7
    // where P0 is P without LP
    const opening = rollOpening(r.name);
    const profile = PROFILE[r.name]!;
    const june = JUNE[r.name]!;
    const base = computeMtdRaw({
      opening,
      juneGross: june.gross,
      juneEpf: june.epfEmployee,
      category: profile.category,
      childCount: profile.childCount,
      lp: 0,
    });
    // mtd = ( (P-LP-M)*r/100 + B - X ) / 7
    // 7*acct = (P-M)*r/100 + B - X - LP*r/100
    // LP*r/100 = (P-M)*r/100 + B - X - 7*acct
    // LP = [ (P-M)*r/100 + B - X - 7*acct ] * 100 / r
    const bracket = PCB_TAX_BRACKETS_2026.find((b) => base.P <= b.maxP)!;
    const bVal =
      profile.category === 2 ? bracket.bCat2 : bracket.bCat1And3;
    const numeratorAtZeroLp =
      ((base.P - bracket.m) * bracket.r) / 100 +
      bVal -
      opening.accumulatedMtdX;
    const lpNeeded =
      (numeratorAtZeroLp - r.acct * 7) * (100 / bracket.r);
    console.log(
      `  LP to hit acct exactly (before 5-sen): ${money(lpNeeded)} (if LP applied to P)`
    );

    // X needed to hit accounting exactly (before 5-sen, then apply 5-sen)
    // Find X such that roundUpToNearest5Sen( (num0 + X0 - X) / 7 ) = acct
    // where num0 uses current X0 in formula as (stuff - X)
    const stuff =
      ((base.P - bracket.m) * bracket.r) / 100 + bVal;
    // mtdRaw = (stuff - X) / 7
    // We want roundUp5(mtdRaw) = acct
    // So mtdRaw in (acct-0.05, acct] after cent rounding path
    // Using: cents = round(mtdRaw*100), ceil(cents/5)*5/100 = acct
    // So cents in (acct*100 - 5, acct*100] mapped by ceil to acct*100
    // i.e. cents in [acct*100 - 4, acct*100]
    // mtdRaw in [acct - 0.04, acct] approximately after round
    for (const targetRaw of [r.acct, r.acct - 0.01, r.acct - 0.02, r.acct - 0.03, r.acct - 0.04]) {
      const xNeeded = stuff - targetRaw * 7;
      const check = roundUpToNearest5Sen(
        Math.max(0, (stuff - xNeeded) / 7)
      );
      if (Math.abs(check - r.acct) < 0.005) {
        console.log(
          `  X to hit acct (via mtdRaw=${targetRaw.toFixed(2)}): ${money(xNeeded)} (current X=${money(opening.accumulatedMtdX)}, ΔX=${money(xNeeded - opening.accumulatedMtdX)})`
        );
        break;
      }
    }
  }

  return rows;
}

function wanDeepDive() {
  console.log("\n=== 3. Wan deep-dive ===\n");

  const hist = HISTORY.Wan!;
  console.log("Wan Jan–May month-by-month roll:");
  let ytd = emptyPcbYearToDate();
  let sumY = 0;
  let sumK = 0;
  let sumX = 0;
  for (const m of [1, 2, 3, 4, 5] as const) {
    const row = hist[m]!;
    sumY += row.y;
    sumK += row.k;
    sumX += row.x;
    ytd = advancePcbYearToDate(ytd, {
      grossSalary: row.y,
      epfEmployee: row.k,
      pcb: row.x,
    });
    console.log(
      `  M${m}: Y=${money(row.y)} K=${money(row.k)} X=${money(row.x)} → cum Y=${money(ytd.accumulatedGrossY)} K=${money(ytd.accumulatedEpfK)} X=${money(ytd.accumulatedMtdX)}`
    );
  }
  console.log(
    `  Manual sum Y=${money(sumY)} K=${money(sumK)} X=${money(sumX)}`
  );
  console.log(
    `  Roll matches manual: Y=${ytd.accumulatedGrossY === sumY} K=${ytd.accumulatedEpfK === sumK} X=${Math.abs(ytd.accumulatedMtdX - sumX) < 0.001}`
  );

  const june = JUNE.Wan!;
  console.log(
    `\nJune Wan gross/EPF (rev7 anchors): gross=${money(june.gross)} epfEmployee=${money(june.epfEmployee)}`
  );
  console.log(
    "  (rev7: base 1700 + wages 3090 = 4790; EPF employee from Part A bracket = 528)"
  );

  const profile = PROFILE.Wan!;
  for (const cat of [1, 2, 3] as const) {
    const maritalStatus = cat === 1 ? "single" : "married";
    const spouseWorking = cat === 1 ? null : cat === 3;
    const childCount = cat === 1 ? 0 : profile.childCount;
    const r = calculateMonthlyPcb({
      grossSalary: june.gross,
      epfEmployee: june.epfEmployee,
      maritalStatus,
      spouseWorking,
      childCount,
      month: 6,
      accumulatedGrossY: ytd.accumulatedGrossY,
      accumulatedEpfK: ytd.accumulatedEpfK,
      accumulatedMtdX: ytd.accumulatedMtdX,
      pcbMaritalDataVerified: true,
    });
    console.log(
      `  Cat${cat}: P=${money(r.annualChargeableP)} PCB=${money(r.pcb)} (acct=11.65)`
    );
  }

  // Reverse X for Cat2 (confirmed spouse not working)
  console.log("\nWan Cat2: solve X such that PCB=11.65");
  const opening = ytd;
  const base = computeMtdRaw({
    opening,
    juneGross: june.gross,
    juneEpf: june.epfEmployee,
    category: 2,
    childCount: 4,
  });
  const bracket = PCB_TAX_BRACKETS_2026.find((b) => base.P <= b.maxP)!;
  const bVal = bracket.bCat2;
  const stuff = ((base.P - bracket.m) * bracket.r) / 100 + bVal;
  console.log(
    `  P=${money(base.P)} K2=${money(base.k2)} stuff=(P-M)*R/100+B=${money(stuff)} currentX=${money(opening.accumulatedMtdX)}`
  );

  // For each possible mtdRaw that 5-sen-rounds to 11.65:
  // cents in [1165-4, 1165] = [1161, 1165] after Math.round(mtdRaw*100)
  // so mtdRaw in [11.605, 11.655) roughly
  const targets: number[] = [];
  for (let c = 1161; c <= 1165; c++) {
    targets.push(c / 100);
  }
  // Also try exact 11.65 raw
  targets.push(11.65);

  for (const targetRaw of targets) {
    const xNeeded = stuff - targetRaw * 7;
    const checkRaw = (stuff - xNeeded) / 7;
    const check = roundUpToNearest5Sen(Math.max(0, checkRaw));
    if (Math.abs(check - 11.65) < 0.005) {
      console.log(
        `  X=${money(xNeeded)} → mtdRaw=${checkRaw.toFixed(6)} → 5sen=${money(check)} | ΔX vs history=${money(xNeeded - opening.accumulatedMtdX)}`
      );
    }
  }

  // Also: what if accounting used half-up to sen only (no 5-sen)?
  // 11.65 exact → X = stuff - 11.65*7
  const xForExact1165 = stuff - 11.65 * 7;
  console.log(
    `  X for mtdRaw exactly 11.65: ${money(xForExact1165)} (ΔX=${money(xForExact1165 - opening.accumulatedMtdX)})`
  );

  // What June PCB would be if X were 0 / if missing one month of X
  for (const [label, x] of [
    ["X=0", 0],
    ["X=history", opening.accumulatedMtdX],
    ["X=history-138.80 (drop May)", opening.accumulatedMtdX - 138.8],
    ["X=history-92.60 (drop Apr)", opening.accumulatedMtdX - 92.6],
  ] as const) {
    const r = calculateMonthlyPcb({
      grossSalary: june.gross,
      epfEmployee: june.epfEmployee,
      maritalStatus: "married",
      spouseWorking: false,
      childCount: 4,
      month: 6,
      accumulatedGrossY: opening.accumulatedGrossY,
      accumulatedEpfK: opening.accumulatedEpfK,
      accumulatedMtdX: x,
      pcbMaritalDataVerified: true,
    });
    console.log(`  ${label}: PCB=${money(r.pcb)}`);
  }
}

async function main() {
  const dbMode = await correctFook();
  const rows = await runJuneValidation(dbMode);
  wanDeepDive();
  console.log(
    `\nDB write status: ${dbMode === "written" ? "Fook updated in DB" : "Fook write PENDING (DB unreachable) — re-run script when DB is up"}`
  );

  const exact = rows.filter((r) => Math.abs(r.delta) < 0.005);
  const near = rows.filter(
    (r) => Math.abs(r.delta) >= 0.005 && Math.abs(r.delta) <= 0.55
  );
  const gap = rows.filter((r) => Math.abs(r.delta) > 0.55);

  console.log("\n=== Summary ===");
  console.log(`Exact: ${exact.map((r) => r.name).join(", ") || "none"}`);
  console.log(
    `Near (≤0.55): ${near.map((r) => `${r.name} Δ${money(r.delta)}`).join(", ") || "none"}`
  );
  console.log(
    `Gap (>0.55): ${gap.map((r) => `${r.name} Δ${money(r.delta)}`).join(", ") || "none"}`
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
