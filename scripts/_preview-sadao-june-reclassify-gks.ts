/**
 * Preview only: re-aggregate June 2026 Sadao handling with Thai large codes
 * (VIO/BS/GKS) and compare to existing sadao_crate_handling_daily rows.
 * Does NOT write.
 *
 * Run: npx tsx --env-file=.env.local scripts/_preview-sadao-june-reclassify-gks.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import {
  resolveSessionPickupLocation,
} from "../lib/constants/pickup-locations";
import { toDateInputValue } from "../lib/date-utils";
import { prisma } from "../lib/prisma";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import { classifyThaiCostCrate } from "../lib/thai-cost/crate-classify";
import { loadCurrentThaiCostRates } from "../lib/thai-cost/rate-settings";
import { getSadaoMonthlyCost } from "../lib/thai-cost/sadao-cost-service";
import {
  computeSadaoHandlingCommission,
} from "../lib/thai-cost/sadao-cost";
import {
  buildPublicHolidayKeySet,
  isHolidayRate,
} from "../lib/thai-cost/holiday";

const YEAR = 2026;
const MONTH = 6;
const PREV_TOTAL = 309281;

type Qty = { small: number; large: number; box: number };

function empty(): Qty {
  return { small: 0, large: 0, box: 0 };
}

function add(q: Qty, bucket: "small" | "large" | "box", n: number) {
  q[bucket] += n;
}

async function aggregateFromDispatch(largeCodes: string[]) {
  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { not: "cancelled" },
      date: { gte: start, lte: end },
    },
    select: {
      date: true,
      lines: {
        select: {
          inboundLine: {
            select: {
              quantity: true,
              dispatchStatus: true,
              isBox: true,
              tongType: { select: { code: true, isBox: true } },
            },
          },
        },
      },
    },
  });

  const byDate = new Map<string, Qty>();
  for (const d of dispatches) {
    const key = toDateInputValue(d.date);
    const day = byDate.get(key) ?? empty();
    for (const dl of d.lines) {
      const line = dl.inboundLine;
      if (!line || line.dispatchStatus !== "assigned") continue;
      const qty = line.quantity ?? 0;
      if (qty <= 0) continue;
      const tongCode = line.tongType?.code ?? "";
      const isBox = line.tongType?.isBox ?? line.isBox ?? false;
      const bucket = classifyThaiCostCrate(tongCode, isBox, largeCodes);
      add(day, bucket, qty);
    }
    byDate.set(key, day);
  }
  return byDate;
}

/** Old classification: VIO/BS only (what June backfill used). */
async function aggregateWithOldCodes() {
  return aggregateFromDispatch(["VIO", "BS"]);
}

async function main() {
  const rates = await loadCurrentThaiCostRates();
  const largeCodes = rates.largeTongTypeCodes;
  console.log("Thai large_tong_type_codes:", largeCodes.join(", "));
  console.log("");

  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const [existing, newByDate, oldByDate, holidays] = await Promise.all([
    prisma.sadaoCrateHandlingDaily.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
    aggregateFromDispatch(largeCodes),
    aggregateWithOldCodes(),
    prisma.thaiPublicHoliday.findMany({
      where: { date: { gte: start, lte: end } },
      select: { date: true },
    }),
  ]);

  const holidayKeys = buildPublicHolidayKeySet(holidays);
  const existingByDate = new Map(
    existing.map((r) => [toDateInputValue(r.date), r])
  );

  const allDates = [
    ...new Set([
      ...existingByDate.keys(),
      ...newByDate.keys(),
      ...oldByDate.keys(),
    ]),
  ].sort();

  console.log("=== Day-by-day: existing DB vs NEW (VIO/BS/GKS) ===");
  console.log(
    "date,db_small,db_large,db_box,new_small,new_large,new_box,d_small,d_large,d_box,gks_moved"
  );

  let sumDbS = 0;
  let sumDbL = 0;
  let sumDbB = 0;
  let sumNewS = 0;
  let sumNewL = 0;
  let sumNewB = 0;
  let sumOldS = 0;
  let sumOldL = 0;
  let sumOldB = 0;
  let commissionOld = 0;
  let commissionNew = 0;
  const changedDays: string[] = [];

  for (const dateKey of allDates) {
    const db = existingByDate.get(dateKey);
    const neu = newByDate.get(dateKey) ?? empty();
    const old = oldByDate.get(dateKey) ?? empty();

    const dbS = db?.smallCrateTotalQty ?? 0;
    const dbL = db?.largeCrateTotalQty ?? 0;
    const dbB = db?.boxTotalQty ?? 0;

    const dS = neu.small - dbS;
    const dL = neu.large - dbL;
    const dB = neu.box - dbB;
    // GKS moved = decrease in small that equals increase in large (vs old codes)
    const gksMoved = old.small - neu.small; // should equal neu.large - old.large

    sumDbS += dbS;
    sumDbL += dbL;
    sumDbB += dbB;
    sumNewS += neu.small;
    sumNewL += neu.large;
    sumNewB += neu.box;
    sumOldS += old.small;
    sumOldL += old.large;
    sumOldB += old.box;

    const date = db?.date ?? calendarDateFromKey(dateKey);
    const holiday = isHolidayRate(date, holidayKeys);
    const oldComm = computeSadaoHandlingCommission(
      {
        smallCrateTotalQty: dbS,
        largeCrateTotalQty: dbL,
        boxTotalQty: dbB,
        smallCrateNoCheckQty: 0,
        largeCrateNoCheckQty: 0,
        boxNoCheckQty: 0,
      },
      { holidayRate: holiday, rateConfig: rates }
    );
    const newComm = computeSadaoHandlingCommission(
      {
        smallCrateTotalQty: neu.small,
        largeCrateTotalQty: neu.large,
        boxTotalQty: neu.box,
        smallCrateNoCheckQty: 0,
        largeCrateNoCheckQty: 0,
        boxNoCheckQty: 0,
      },
      { holidayRate: holiday, rateConfig: rates }
    );
    commissionOld += oldComm.totalCommissionThb;
    commissionNew += newComm.totalCommissionThb;

    if (dS !== 0 || dL !== 0 || dB !== 0) {
      changedDays.push(dateKey);
    }

    console.log(
      `${dateKey},${dbS},${dbL},${dbB},${neu.small},${neu.large},${neu.box},${dS},${dL},${dB},${gksMoved}`
    );
  }

  console.log("");
  console.log("=== Month totals ===");
  console.log(
    `  DB (current):     small=${sumDbS} large=${sumDbL} box=${sumDbB} total=${sumDbS + sumDbL + sumDbB}`
  );
  console.log(
    `  Old codes VIO/BS: small=${sumOldS} large=${sumOldL} box=${sumOldB} total=${sumOldS + sumOldL + sumOldB}`
  );
  console.log(
    `  NEW VIO/BS/GKS:   small=${sumNewS} large=${sumNewL} box=${sumNewB} total=${sumNewS + sumNewL + sumNewB}`
  );
  console.log(
    `  Delta (NEW-DB):   small=${sumNewS - sumDbS} large=${sumNewL - sumDbL} box=${sumNewB - sumDbB}`
  );
  console.log(
    `  GKS moved small→large (month): ${sumOldS - sumNewS} (= large increase ${sumNewL - sumOldL})`
  );
  console.log(`  Days with qty change: ${changedDays.length}`);
  console.log(`  Changed dates: ${changedDays.join(", ") || "(none)"}`);
  console.log("");

  console.log("=== Handling commission (THB) ===");
  console.log(`  Current DB rows: ${commissionOld.toFixed(2)}`);
  console.log(`  After reclassify: ${commissionNew.toFixed(2)}`);
  console.log(`  Delta commission: ${(commissionNew - commissionOld).toFixed(2)}`);
  console.log("");

  // Full Sadao monthly cost with current DB, then projected
  const currentSummary = await getSadaoMonthlyCost(YEAR, MONTH);
  const projectedTotal =
    currentSummary.totalCostThb - commissionOld + commissionNew;

  console.log("=== Sadao monthly total (THB) ===");
  console.log(`  Current (DB):     ${currentSummary.totalCostThb.toFixed(2)}`);
  console.log(`    handling part:  ${currentSummary.handlingCommissionTotalThb.toFixed(2)}`);
  console.log(`  Projected (NEW):  ${projectedTotal.toFixed(2)}`);
  console.log(`  Prior baseline:   ${PREV_TOTAL}`);
  console.log(
    `  Delta vs current: ${(projectedTotal - currentSummary.totalCostThb).toFixed(2)}`
  );
  console.log(
    `  Delta vs 309281:  ${(projectedTotal - PREV_TOTAL).toFixed(2)}`
  );
  console.log("");
  console.log(
    "PREVIEW ONLY — no writes. Confirm to run overwrite script."
  );
}

function calendarDateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
