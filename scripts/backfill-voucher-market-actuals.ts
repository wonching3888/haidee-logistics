/**
 * Step 8: Backfill market_actuals for legacy confirmed vouchers (UI housekeeping).
 *
 * Dry-run (default): npx tsx --env-file=.env.local scripts/backfill-voucher-market-actuals.ts
 * Execute:          npx tsx --env-file=.env.local scripts/backfill-voucher-market-actuals.ts --execute
 *
 * - Idempotent: skips vouchers that already have market_actuals rows
 * - Does NOT call applyVoucherCostActuals (no override changes)
 * - Does NOT change cost_applied_at / status
 */
import { prisma } from "../lib/prisma";
import {
  getVoucherPrintBreakdown,
  listUnloadingFees,
} from "../lib/driver-expense-service";
import {
  feeMarketsForDisplayMarket,
  type DisplayMarket,
} from "../lib/driver-expense/market-display-map";
import type { MarketActualFeeType } from "../lib/driver-expense/market-actuals-service";
import {
  effectiveKpbFee,
  effectiveUnloadFee,
} from "../lib/unloading-calculator";

const TARGET_VOUCHER_NOS = ["V-20260610-001", "V-20260611-001"] as const;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function dbHostLabel(url?: string) {
  if (!url) return "(missing DATABASE_URL)";
  try {
    return new URL(url).hostname;
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

interface PlannedRow {
  voucherNo: string;
  voucherId: string;
  feeType: MarketActualFeeType;
  displayMarket: string;
  amount: number;
}

function sumEffectiveByFeeMarkets(
  unloadingFees: Awaited<ReturnType<typeof listUnloadingFees>>,
  markets: readonly string[],
  mode: "kpb" | "unload"
) {
  let total = 0;
  for (const row of unloadingFees) {
    if (!markets.includes(row.market)) continue;
    total +=
      mode === "kpb"
        ? effectiveKpbFee(row)
        : effectiveUnloadFee(row);
  }
  return roundMoney(total);
}

async function planRowsForVoucher(voucher: {
  id: string;
  voucherNo: string;
  tripId: string;
  parkingActual: number | null;
}): Promise<PlannedRow[]> {
  const breakdown = await getVoucherPrintBreakdown(voucher.tripId);
  const unloadingFees = await listUnloadingFees({ tripId: voucher.tripId });
  const planned: PlannedRow[] = [];

  const parkingMarkets = breakdown.parking.map((row) => row.market);
  if (voucher.parkingActual != null && parkingMarkets.length > 0) {
    if (parkingMarkets.length === 1) {
      planned.push({
        voucherNo: voucher.voucherNo,
        voucherId: voucher.id,
        feeType: "parking",
        displayMarket: parkingMarkets[0]!,
        amount: roundMoney(voucher.parkingActual),
      });
    } else {
      throw new Error(
        `${voucher.voucherNo}: multi-market parking split not implemented (${parkingMarkets.join(", ")})`
      );
    }
  }

  for (const row of breakdown.kpb) {
    const amount = sumEffectiveByFeeMarkets(
      unloadingFees,
      feeMarketsForDisplayMarket(row.market),
      "kpb"
    );
    if (amount <= 0) continue;
    planned.push({
      voucherNo: voucher.voucherNo,
      voucherId: voucher.id,
      feeType: "kpb",
      displayMarket: row.market,
      amount,
    });
  }

  for (const row of breakdown.upahTurun) {
    const amount = sumEffectiveByFeeMarkets(
      unloadingFees,
      feeMarketsForDisplayMarket(row.market as DisplayMarket),
      "unload"
    );
    if (amount <= 0) continue;
    planned.push({
      voucherNo: voucher.voucherNo,
      voucherId: voucher.id,
      feeType: "unload",
      displayMarket: row.market,
      amount,
    });
  }

  return planned;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const mode = execute ? "EXECUTE" : "DRY-RUN";

  console.log(`=== Step 8: market_actuals backfill [${mode}] ===\n`);
  console.log(`Report time: ${new Date().toISOString()}`);
  console.log(`Database host: ${dbHostLabel(process.env.DATABASE_URL)}\n`);

  const vouchers = await prisma.driverVoucher.findMany({
    where: { voucherNo: { in: [...TARGET_VOUCHER_NOS] } },
    orderBy: { voucherNo: "asc" },
    select: {
      id: true,
      voucherNo: true,
      tripId: true,
      status: true,
      costAppliedAt: true,
      parkingActual: true,
      kpbActual: true,
      upahTurunActual: true,
      _count: { select: { marketActuals: true } },
    },
  });

  if (vouchers.length !== TARGET_VOUCHER_NOS.length) {
    const found = new Set(vouchers.map((v) => v.voucherNo));
    const missing = TARGET_VOUCHER_NOS.filter((no) => !found.has(no));
    throw new Error(`Missing vouchers: ${missing.join(", ")}`);
  }

  const allPlanned: PlannedRow[] = [];

  for (const voucher of vouchers) {
    console.log(`--- ${voucher.voucherNo} ---`);
    console.log(`   status=${voucher.status}`);
    console.log(
      `   cost_applied_at=${voucher.costAppliedAt?.toISOString() ?? "null"}`
    );
    console.log(`   existing market_actuals rows: ${voucher._count.marketActuals}`);

    if (voucher._count.marketActuals > 0) {
      console.log("   SKIP (already has market_actuals)\n");
      continue;
    }

    const rows = await planRowsForVoucher(voucher);
    console.log(`   planned INSERT rows: ${rows.length}`);
    for (const row of rows) {
      console.log(
        `     ${row.feeType.padEnd(7)} @ ${row.displayMarket.padEnd(10)} = ${row.amount.toFixed(2)}`
      );
      allPlanned.push(row);
    }

    const parkingSum = roundMoney(
      rows.filter((r) => r.feeType === "parking").reduce((s, r) => s + r.amount, 0)
    );
    const kpbSum = roundMoney(
      rows.filter((r) => r.feeType === "kpb").reduce((s, r) => s + r.amount, 0)
    );
    const unloadSum = roundMoney(
      rows.filter((r) => r.feeType === "unload").reduce((s, r) => s + r.amount, 0)
    );
    console.log("   scalar check:");
    console.log(
      `     parking ${voucher.parkingActual} vs planned ${parkingSum} ${Math.abs((voucher.parkingActual ?? 0) - parkingSum) <= 0.01 ? "ok" : "MISMATCH"}`
    );
    console.log(
      `     kpb ${voucher.kpbActual} vs planned ${kpbSum} ${Math.abs((voucher.kpbActual ?? 0) - kpbSum) <= 0.01 ? "ok" : "MISMATCH"}`
    );
    console.log(
      `     unload ${voucher.upahTurunActual} vs planned ${unloadSum} ${Math.abs((voucher.upahTurunActual ?? 0) - unloadSum) <= 0.01 ? "ok" : "MISMATCH"}`
    );
    console.log("");
  }

  console.log("=== Summary ===");
  console.log(`Vouchers targeted: ${TARGET_VOUCHER_NOS.length}`);
  console.log(`Total rows to INSERT: ${allPlanned.length}`);

  if (allPlanned.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  if (!execute) {
    console.log("\nDRY-RUN complete — no data changed.");
    console.log("Re-run with --execute after approval.");
    return;
  }

  console.log("\nExecuting INSERT...");
  for (const row of allPlanned) {
    await prisma.driverVoucherMarketActual.create({
      data: {
        voucherId: row.voucherId,
        feeType: row.feeType,
        displayMarket: row.displayMarket,
        amount: row.amount,
      },
    });
  }
  console.log(`Inserted ${allPlanned.length} market_actuals rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
