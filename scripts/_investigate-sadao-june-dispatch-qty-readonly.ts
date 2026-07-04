/**
 * Read-only: June 2026 dispatch crate quantities for Sadao handling backfill plan.
 * Does NOT write.
 *
 * Run: npx tsx --env-file=.env.local scripts/_investigate-sadao-june-dispatch-qty-readonly.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import {
  resolveSessionPickupLocation,
  type PickupLocation,
} from "../lib/constants/pickup-locations";
import { prisma } from "../lib/prisma";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import { toDateInputValue } from "../lib/date-utils";
import { classifyThaiCostCrate } from "../lib/thai-cost/crate-classify";
import { loadCurrentThaiCostRates } from "../lib/thai-cost/rate-settings";

const YEAR = 2026;
const MONTH = 6;

type Bucket = "small" | "large" | "box";

type DayAgg = {
  small: number;
  large: number;
  box: number;
  byPickup: Record<PickupLocation, { small: number; large: number; box: number }>;
  byTruckCountry: Record<string, { small: number; large: number; box: number }>;
  dispatchCount: number;
  lineCount: number;
};

function emptyBuckets() {
  return { small: 0, large: 0, box: 0 };
}

function emptyDay(): DayAgg {
  return {
    ...emptyBuckets(),
    byPickup: {
      SADAO: emptyBuckets(),
      SONGKHLA: emptyBuckets(),
      PATTANI: emptyBuckets(),
    },
    byTruckCountry: {},
    dispatchCount: 0,
    lineCount: 0,
  };
}

function add(
  target: { small: number; large: number; box: number },
  bucket: Bucket,
  qty: number
) {
  target[bucket] += qty;
}

async function main() {
  const { start, end, lastDay } = getMonthDateRange(YEAR, MONTH);
  const rates = await loadCurrentThaiCostRates();
  const largeCodes = rates.largeTongTypeCodes;

  const classifyCrate = (tongCode: string, isBox: boolean): Bucket =>
    classifyThaiCostCrate(tongCode, isBox, largeCodes);

  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { not: "cancelled" },
      date: { gte: start, lte: end },
    },
    select: {
      id: true,
      date: true,
      status: true,
      truck: { select: { plate: true, country: true } },
      lines: {
        select: {
          inboundLine: {
            select: {
              quantity: true,
              dispatchStatus: true,
              isBox: true,
              tongType: { select: { code: true, isBox: true } },
              stall: { select: { market: { select: { code: true } } } },
              session: {
                select: {
                  pickupLocation: true,
                  shipper: { select: { pickupLocation: true, code: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  const byDate = new Map<string, DayAgg>();
  const dispatchIdsByDate = new Map<string, Set<string>>();

  let skippedUnassigned = 0;
  let skippedZero = 0;
  let skippedNoLine = 0;

  for (const d of dispatches) {
    const dateKey = toDateInputValue(d.date);
    const day = byDate.get(dateKey) ?? emptyDay();
    const ids = dispatchIdsByDate.get(dateKey) ?? new Set<string>();
    ids.add(d.id);
    dispatchIdsByDate.set(dateKey, ids);

    const country = (d.truck.country || "UNKNOWN").toUpperCase();
    if (!day.byTruckCountry[country]) {
      day.byTruckCountry[country] = emptyBuckets();
    }

    for (const dl of d.lines) {
      const line = dl.inboundLine;
      if (!line) {
        skippedNoLine += 1;
        continue;
      }
      if (line.dispatchStatus !== "assigned") {
        skippedUnassigned += 1;
        continue;
      }
      const qty = line.quantity ?? 0;
      if (qty <= 0) {
        skippedZero += 1;
        continue;
      }

      const tongCode = line.tongType?.code ?? "";
      const isBox = line.tongType?.isBox ?? line.isBox ?? false;
      const bucket = classifyCrate(tongCode, isBox);
      const pickup = resolveSessionPickupLocation(
        line.session.pickupLocation,
        line.session.shipper.pickupLocation
      );

      add(day, bucket, qty);
      add(day.byPickup[pickup], bucket, qty);
      add(day.byTruckCountry[country], bucket, qty);
      day.lineCount += 1;
    }

    byDate.set(dateKey, day);
  }

  for (const [dateKey, day] of byDate) {
    day.dispatchCount = dispatchIdsByDate.get(dateKey)?.size ?? 0;
  }

  // Totals
  const allDays = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  const sumAll = emptyBuckets();
  const sumSadaoPickup = emptyBuckets();
  const sumNonSadaoPickup = emptyBuckets();
  const sumByCountry: Record<string, { small: number; large: number; box: number }> =
    {};

  for (const [, day] of allDays) {
    add(sumAll, "small", day.small);
    add(sumAll, "large", day.large);
    add(sumAll, "box", day.box);
    add(sumSadaoPickup, "small", day.byPickup.SADAO.small);
    add(sumSadaoPickup, "large", day.byPickup.SADAO.large);
    add(sumSadaoPickup, "box", day.byPickup.SADAO.box);
    add(sumNonSadaoPickup, "small", day.byPickup.SONGKHLA.small + day.byPickup.PATTANI.small);
    add(sumNonSadaoPickup, "large", day.byPickup.SONGKHLA.large + day.byPickup.PATTANI.large);
    add(sumNonSadaoPickup, "box", day.byPickup.SONGKHLA.box + day.byPickup.PATTANI.box);
    for (const [c, b] of Object.entries(day.byTruckCountry)) {
      if (!sumByCountry[c]) sumByCountry[c] = emptyBuckets();
      add(sumByCountry[c], "small", b.small);
      add(sumByCountry[c], "large", b.large);
      add(sumByCountry[c], "box", b.box);
    }
  }

  // Days with no dispatch in June
  const missingDays: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const key = `${YEAR}-${String(MONTH).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (!byDate.has(key)) missingDays.push(key);
  }

  console.log("=== Data path ===");
  console.log(
    "dispatch_orders (status≠cancelled, date=dispatch date)"
  );
  console.log("  → dispatch_lines.dispatch_order_id");
  console.log("  → inbound_lines (via inbound_line_id)");
  console.log("    quantity, tong_type_id → tong_types.code / is_box");
  console.log("    session_id → inbound_sessions.pickup_location");
  console.log("    shipper.pickup_location (fallback)");
  console.log("  truck_id → trucks.country (MY/TH)");
  console.log("");
  console.log("Bucket rules (Thai-cost only, NOT MY unloading):");
  console.log("  box  = tong_types.is_box OR code=BOX");
  console.log(`  large = code in {${largeCodes.join(", ")}}`);
  console.log("  small = everything else");
  console.log("  MY unloading still uses VIO/BS only (driver-expense LARGE_CRATE_CODES)");
  console.log("");

  console.log("=== June 2026 coverage ===");
  console.log(`  calendar days: ${lastDay}`);
  console.log(`  days with non-cancelled dispatch: ${allDays.length}`);
  console.log(`  days with zero dispatch: ${missingDays.length}`);
  if (missingDays.length) {
    console.log(`  missing dates: ${missingDays.join(", ")}`);
  }
  console.log(`  total dispatches: ${dispatches.length}`);
  console.log(
    `  skipped lines: unassigned=${skippedUnassigned} zeroQty=${skippedZero} noLine=${skippedNoLine}`
  );
  console.log("");

  console.log("=== Month totals (ALL assigned lines on non-cancelled dispatches) ===");
  console.log(
    `  ALL pickup:     small=${sumAll.small} large=${sumAll.large} box=${sumAll.box} total=${sumAll.small + sumAll.large + sumAll.box}`
  );
  console.log(
    `  pickup=SADAO:   small=${sumSadaoPickup.small} large=${sumSadaoPickup.large} box=${sumSadaoPickup.box} total=${sumSadaoPickup.small + sumSadaoPickup.large + sumSadaoPickup.box}`
  );
  console.log(
    `  pickup≠SADAO:   small=${sumNonSadaoPickup.small} large=${sumNonSadaoPickup.large} box=${sumNonSadaoPickup.box} total=${sumNonSadaoPickup.small + sumNonSadaoPickup.large + sumNonSadaoPickup.box}`
  );
  for (const [c, b] of Object.entries(sumByCountry)) {
    console.log(
      `  truck.country=${c}: small=${b.small} large=${b.large} box=${b.box} total=${b.small + b.large + b.box}`
    );
  }
  console.log("");

  // Cross: non-Sadao pickup × truck country
  const cross: Record<string, { small: number; large: number; box: number }> = {};
  for (const d of dispatches) {
    const country = (d.truck.country || "UNKNOWN").toUpperCase();
    for (const dl of d.lines) {
      const line = dl.inboundLine;
      if (!line || line.dispatchStatus !== "assigned") continue;
      const qty = line.quantity ?? 0;
      if (qty <= 0) continue;
      const pickup = resolveSessionPickupLocation(
        line.session.pickupLocation,
        line.session.shipper.pickupLocation
      );
      const key = `${pickup}|${country}`;
      if (!cross[key]) cross[key] = emptyBuckets();
      const bucket = classifyCrate(
        line.tongType?.code ?? "",
        line.tongType?.isBox ?? line.isBox ?? false
      );
      add(cross[key], bucket, qty);
    }
  }
  console.log("=== Cross: pickupLocation × truck.country ===");
  for (const key of Object.keys(cross).sort()) {
    const b = cross[key];
    console.log(
      `  ${key}: small=${b.small} large=${b.large} box=${b.box} total=${b.small + b.large + b.box}`
    );
  }
  console.log("");

  console.log("=== Daily preview (ALL assigned) ===");
  console.log("date,dispatches,small,large,box,total,sadaoPickupTotal,nonSadaoPickupTotal");
  for (const [dateKey, day] of allDays) {
    const sadaoP =
      day.byPickup.SADAO.small +
      day.byPickup.SADAO.large +
      day.byPickup.SADAO.box;
    const nonSadaoP =
      day.byPickup.SONGKHLA.small +
      day.byPickup.SONGKHLA.large +
      day.byPickup.SONGKHLA.box +
      day.byPickup.PATTANI.small +
      day.byPickup.PATTANI.large +
      day.byPickup.PATTANI.box;
    const total = day.small + day.large + day.box;
    console.log(
      `${dateKey},${day.dispatchCount},${day.small},${day.large},${day.box},${total},${sadaoP},${nonSadaoP}`
    );
  }

  console.log("");
  console.log("=== Daily preview IF filter pickup=SADAO only ===");
  console.log("date,small,large,box,total");
  for (const [dateKey, day] of allDays) {
    const p = day.byPickup.SADAO;
    console.log(
      `${dateKey},${p.small},${p.large},${p.box},${p.small + p.large + p.box}`
    );
  }

  console.log("");
  console.log("=== Attendance preview (all 30 calendar days) ===");
  console.log("date,attendanceCount,dailyWage,dayCost");
  let attTotal = 0;
  for (let d = 1; d <= lastDay; d++) {
    const key = `${YEAR}-${String(MONTH).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const cost = 21 * 300;
    attTotal += cost;
    console.log(`${key},21,300,${cost}`);
  }
  console.log(`attendance month total: ${attTotal}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
