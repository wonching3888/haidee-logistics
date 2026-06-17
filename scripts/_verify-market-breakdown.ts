/**
 * Verify buildPnlCustomerMarketBreakdown vs buildPnlCustomerAnalysis + buildPnlTripDetail.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import {
  buildPnlCustomerMarketBreakdown,
  buildPnlCustomerAnalysis,
  buildPnlTripDetail,
} from "../lib/pnl-report";

const YEAR = 2026;
const MONTH = 6;

const SHIPPERS = [
  { code: "3002-S006", name: "SAKDA PATTANI" },
  { code: "3001-A004", name: "AR MEI" },
];

const EIGHT_TRIPS = [
  { date: "2026-06-13", plate: "KGC 3888" },
  { date: "2026-06-13", plate: "KFW 3888" },
  { date: "2026-06-13", plate: "PQK 6398" },
  { date: "2026-06-13", plate: "KFJ 3888" },
  { date: "2026-06-12", plate: "VNN 3888" },
  { date: "2026-06-12", plate: "PQL 3888" },
  { date: "2026-06-12", plate: "KFK 3888" },
  { date: "2026-06-12", plate: "PKS 7679" },
];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function marketDirectCost(m: {
  crateRentalMyr: number;
  lkimMaqisMyr: number;
  thaiSegmentMyr: number;
  unloadFeeMyr: number;
}) {
  return round2(
    m.crateRentalMyr + m.lkimMaqisMyr + m.thaiSegmentMyr + m.unloadFeeMyr
  );
}

function sumMarkets(
  markets: Awaited<ReturnType<typeof buildPnlCustomerMarketBreakdown>>
) {
  return markets.reduce(
    (acc, m) => ({
      quantity: acc.quantity + m.quantity,
      revenueMyr: round2(acc.revenueMyr + m.revenueMyr),
      directCostMyr: round2(acc.directCostMyr + marketDirectCost(m)),
      allocatedCostMyr: round2(acc.allocatedCostMyr + m.allocatedCostMyr),
      unloadFeeMyr: round2(acc.unloadFeeMyr + m.unloadFeeMyr),
      totalCostMyr: round2(acc.totalCostMyr + m.totalCostMyr),
      grossProfitMyr: round2(acc.grossProfitMyr + m.grossProfitMyr),
    }),
    {
      quantity: 0,
      revenueMyr: 0,
      directCostMyr: 0,
      allocatedCostMyr: 0,
      unloadFeeMyr: 0,
      totalCostMyr: 0,
      grossProfitMyr: 0,
    }
  );
}

function diff(a: number, b: number) {
  return round2(Math.abs(a - b));
}

async function testDbConnection() {
  const rows = await prisma.$queryRaw<
    { cnt: bigint }[]
  >`SELECT COUNT(*)::bigint AS cnt FROM dispatch_orders WHERE date >= '2026-06-01'::date AND date <= '2026-06-30'::date`;
  const cnt = Number(rows[0]?.cnt ?? 0);
  console.log(`\n=== DB Connection OK ===`);
  console.log(`dispatch_orders in 2026-06: ${cnt}`);
  return cnt;
}

async function verifyShipperMarketBreakdown(
  shipperCode: string,
  shipperName: string,
  customerAnalysis: Awaited<ReturnType<typeof buildPnlCustomerAnalysis>>
) {
  const shipper = await prisma.shipper.findFirst({
    where: { code: shipperCode },
    select: { id: true, code: true, name: true },
  });
  if (!shipper) {
    console.log(`\n[FAIL] Shipper not found: ${shipperCode}`);
    return false;
  }

  const markets = await buildPnlCustomerMarketBreakdown({
    shipperId: shipper.id,
    year: YEAR,
    month: MONTH,
  });
  const marketSum = sumMarkets(markets);
  const customerRow = customerAnalysis.customers.find(
    (c) => c.shipperId === shipper.id
  );

  console.log(`\n=== Market Breakdown: ${shipperName} (${shipperCode}) ===`);
  console.log(`Markets: ${markets.length}`);
  for (const m of markets) {
    console.log(
      `  ${m.marketCode}: qty=${m.quantity} rev=${m.revenueMyr} direct=${marketDirectCost(m)} alloc=${m.allocatedCostMyr} unload=${m.unloadFeeMyr} totalCost=${m.totalCostMyr} profit=${m.grossProfitMyr}`
    );
  }
  console.log(`Market sum:`, JSON.stringify(marketSum));

  if (!customerRow) {
    console.log(`[WARN] No customer analysis row for ${shipperCode}`);
    return markets.length === 0;
  }

  console.log(`Customer tab row:`, {
    totalQuantity: customerRow.totalQuantity,
    revenueMyr: customerRow.revenueMyr,
    directCostMyr: customerRow.directCostMyr,
    allocatedCostMyr: customerRow.allocatedCostMyr,
    totalCostMyr: customerRow.totalCostMyr,
    grossProfitMyr: customerRow.grossProfitMyr,
  });

  const checks = [
    ["quantity", marketSum.quantity, customerRow.totalQuantity],
    ["revenueMyr", marketSum.revenueMyr, customerRow.revenueMyr],
    ["directCostMyr", marketSum.directCostMyr, customerRow.directCostMyr],
    [
      "allocatedCostMyr",
      marketSum.allocatedCostMyr,
      customerRow.allocatedCostMyr,
    ],
    ["totalCostMyr", marketSum.totalCostMyr, customerRow.totalCostMyr],
    ["grossProfitMyr", marketSum.grossProfitMyr, customerRow.grossProfitMyr],
  ] as const;

  let pass = true;
  for (const [field, sum, row] of checks) {
    const d = diff(sum, row);
    const ok = d <= 0.02;
    console.log(
      `  ${ok ? "PASS" : "FAIL"} ${field}: marketSum=${sum} customerRow=${row} diff=${d}`
    );
    if (!ok) pass = false;
  }

  // Cross-check unload from trip detail for this shipper
  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { notIn: ["draft", "cancelled"] },
      date: {
        gte: new Date("2026-06-01"),
        lte: new Date("2026-06-30"),
      },
      lines: {
        some: {
          inboundLine: {
            dispatchStatus: "assigned",
            session: { shipperId: shipper.id },
          },
        },
      },
    },
    select: { id: true, date: true, truck: { select: { plate: true } } },
  });

  let tripDetailUnload = 0;
  let tripDetailAlloc = 0;
  let tripDetailTotalCost = 0;
  for (const d of dispatches) {
    const trip = await buildPnlTripDetail({
      tripId: d.id,
      year: YEAR,
      month: MONTH,
    });
    const shipperRow = trip.shippers.find((s) => s.shipperId === shipper.id);
    if (!shipperRow) continue;
    tripDetailUnload = round2(tripDetailUnload + shipperRow.unloadFeeMyr);
    tripDetailAlloc = round2(
      tripDetailAlloc + shipperRow.allocatedCostMyr
    );
    tripDetailTotalCost = round2(
      tripDetailTotalCost + shipperRow.totalCostMyr
    );
  }

  console.log(`Trip detail aggregate for shipper:`);
  console.log(`  unloadFeeMyr=${tripDetailUnload} (marketSum=${marketSum.unloadFeeMyr})`);
  console.log(`  allocatedCostMyr=${tripDetailAlloc} (marketSum=${marketSum.allocatedCostMyr})`);
  console.log(`  totalCostMyr=${tripDetailTotalCost} (marketSum=${marketSum.totalCostMyr})`);

  for (const [label, tripVal, marketVal] of [
    ["unloadFeeMyr", tripDetailUnload, marketSum.unloadFeeMyr],
    ["allocatedCostMyr", tripDetailAlloc, marketSum.allocatedCostMyr],
    ["totalCostMyr", tripDetailTotalCost, marketSum.totalCostMyr],
  ] as const) {
    const d = diff(tripVal, marketVal);
    const ok = d <= 0.02;
    console.log(
      `  ${ok ? "PASS" : "FAIL"} trip vs market ${label}: trip=${tripVal} market=${marketVal} diff=${d}`
    );
    if (!ok) pass = false;
  }

  return pass;
}

async function verifyEightTrips() {
  console.log(`\n=== 8-Trip Regression (post 524f952) ===`);
  let allPass = true;

  for (const { date, plate } of EIGHT_TRIPS) {
    const dispatch = await prisma.dispatchOrder.findFirst({
      where: {
        date: new Date(date),
        truck: { plate },
        status: { notIn: ["draft", "cancelled"] },
      },
      select: {
        id: true,
        truck: { select: { plate: true } },
      },
    });

    if (!dispatch) {
      console.log(`[FAIL] Trip not found: ${date} ${plate}`);
      allPass = false;
      continue;
    }

    const trip = await buildPnlTripDetail({
      tripId: dispatch.id,
      year: YEAR,
      month: MONTH,
    });

    const unloadSum = round2(
      trip.shippers.reduce((s, r) => s + r.unloadFeeMyr, 0)
    );

    const unloadingRows = await prisma.unloadingFee.findMany({
      where: { tripId: dispatch.id },
    });
    const loadingRows = await prisma.crateLoadingFee.findMany({
      where: { tripId: dispatch.id },
    });
    const billTotal = round2(
      unloadingRows.reduce(
        (s, r) =>
          s +
          Number(r.unloadFeeOverride ?? r.unloadFee) +
          (r.isKpbExempt ? 0 : Number(r.kpbFeeOverride ?? r.kpbFee)),
        0
      ) +
        loadingRows.reduce(
          (s, r) => s + Number(r.loadingFeeOverride ?? r.loadingFee),
          0
        )
    );

    // Allow up to 0.10 MYR drift from per-shipper roundMoney on multi-shipper trips
    const unloadOk = diff(unloadSum, billTotal) <= 0.1;
    console.log(
      `\n${date} ${plate}: revenue=${trip.revenueMyr} cost=${trip.totalCostMyr} profit=${trip.grossProfitMyr} (${trip.marginPct}%)`
    );
    console.log(
      `  ${unloadOk ? "PASS" : "FAIL"} unload sum=${unloadSum} bill=${billTotal} diff=${diff(unloadSum, billTotal)}`
    );
    console.log(
      `  shippers=${trip.shippers.length} totalQty=${trip.totalQuantity}`
    );

    if (!unloadOk) allPass = false;
  }

  return allPass;
}

async function main() {
  try {
    await testDbConnection();

    console.log(`\nLoading customer analysis...`);
    const customerAnalysis = await buildPnlCustomerAnalysis({
      year: YEAR,
      month: MONTH,
    });

    let shipperPass = true;
    for (const s of SHIPPERS) {
      const ok = await verifyShipperMarketBreakdown(
        s.code,
        s.name,
        customerAnalysis
      );
      if (!ok) shipperPass = false;
    }

    const eightPass = await verifyEightTrips();

    console.log(`\n=== SUMMARY ===`);
    console.log(`Market breakdown vs customer tab: ${shipperPass ? "PASS" : "FAIL"}`);
    console.log(`8-trip regression: ${eightPass ? "PASS" : "FAIL"}`);
    console.log(
      `Overall: ${shipperPass && eightPass ? "ALL PASS" : "SOME FAILURES"}`
    );
  } catch (e) {
    console.error("\nDB_FAIL", e instanceof Error ? e.message : String(e));
    if (e instanceof Error && e.stack) console.error(e.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
