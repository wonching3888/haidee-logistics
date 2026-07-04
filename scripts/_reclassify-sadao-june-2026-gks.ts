/**
 * Overwrite June 2026 sadao_crate_handling_daily with Thai large codes VIO/BS/GKS.
 * Run: npx tsx --env-file=.env.local scripts/_reclassify-sadao-june-2026-gks.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { toDateInputValue } from "../lib/date-utils";
import { prisma } from "../lib/prisma";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import { classifyThaiCostCrate } from "../lib/thai-cost/crate-classify";
import { loadCurrentThaiCostRates } from "../lib/thai-cost/rate-settings";
import { getSadaoMonthlyCost } from "../lib/thai-cost/sadao-cost-service";

const YEAR = 2026;
const MONTH = 6;
const EXPECTED_TOTAL = 309661;
const NOTES =
  "JUNE2026_BACKFILL from dispatch (all assigned, pickup-agnostic); RECLASSIFY GKS→large (VIO/BS/GKS)";

type Qty = { small: number; large: number; box: number };

async function main() {
  const rates = await loadCurrentThaiCostRates();
  const largeCodes = rates.largeTongTypeCodes;
  console.log("large_tong_type_codes:", largeCodes.join(", "));

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
    const day = byDate.get(key) ?? { small: 0, large: 0, box: 0 };
    for (const dl of d.lines) {
      const line = dl.inboundLine;
      if (!line || line.dispatchStatus !== "assigned") continue;
      const qty = line.quantity ?? 0;
      if (qty <= 0) continue;
      const tongCode = line.tongType?.code ?? "";
      const isBox = line.tongType?.isBox ?? line.isBox ?? false;
      const bucket = classifyThaiCostCrate(tongCode, isBox, largeCodes);
      day[bucket] += qty;
    }
    byDate.set(key, day);
  }

  const existing = await prisma.sadaoCrateHandlingDaily.findMany({
    where: { date: { gte: start, lte: end } },
  });
  const existingByDate = new Map(
    existing.map((r) => [toDateInputValue(r.date), r])
  );

  let updated = 0;
  for (const [dateKey, qty] of [...byDate.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const row = existingByDate.get(dateKey);
    if (!row) {
      console.warn(`SKIP missing row for ${dateKey}`);
      continue;
    }
    await prisma.sadaoCrateHandlingDaily.update({
      where: { id: row.id },
      data: {
        smallCrateTotalQty: qty.small,
        largeCrateTotalQty: qty.large,
        boxTotalQty: qty.box,
        smallCrateNoCheckQty: 0,
        largeCrateNoCheckQty: 0,
        boxNoCheckQty: 0,
        notes: NOTES,
      },
    });
    updated += 1;
    console.log(
      `UPDATE ${dateKey}: small=${qty.small} large=${qty.large} box=${qty.box}`
    );
  }

  console.log(`\nUpdated ${updated} rows.`);

  const summary = await getSadaoMonthlyCost(YEAR, MONTH);
  console.log("\n=== getSadaoMonthlyCost(2026,6) ===");
  console.log(`  monthlyWorkerTotalThb: ${summary.monthlyWorkerTotalThb}`);
  console.log(`  dailyLaborWageTotalThb: ${summary.dailyLaborWageTotalThb}`);
  console.log(`  dailyLaborLunchTotalThb: ${summary.dailyLaborLunchTotalThb}`);
  console.log(
    `  handlingCommissionTotalThb: ${summary.handlingCommissionTotalThb}`
  );
  console.log(`  totalCostThb: ${summary.totalCostThb}`);

  if (Math.abs(summary.totalCostThb - EXPECTED_TOTAL) < 0.01) {
    console.log(`\nPASS: totalCostThb === ${EXPECTED_TOTAL}`);
  } else {
    console.error(
      `\nFAIL: expected ${EXPECTED_TOTAL}, got ${summary.totalCostThb}`
    );
    process.exitCode = 1;
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
