/**
 * Step 5: June 2026 trip cost shadow snapshot (read-only, no production changes).
 *
 * Usage:
 *   npx tsx scripts/snapshot-trip-costs.ts
 *   npx tsx scripts/snapshot-trip-costs.ts --year=2026 --month=6
 *
 * Optional env for script only (production stays legacy):
 *   VEHICLE_ALLOC_MODE=shadow VOUCHER_COST_MODE=shadow
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { getRouteLabel } from "@/lib/payroll-route-label";
import { loadPnlDispatchTripRowsForPeriod } from "@/lib/pnl-report";
import {
  computeTripRouteCosts,
  findApplicableRoutes,
  loadGlobalTripCostValues,
  type RouteMasterCostRow,
} from "@/lib/operations-cost";
import {
  effectiveMarketsForTripCost,
  mcAssignedLinesFromDispatchLines,
} from "@/lib/mc-dispatch-delivery";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { reloadTripCostEngineConfig } from "@/lib/trip-cost-engine/config";
import {
  auditRouteMileageMaster,
  buildVehicleShadowDiffs,
  compareTripVehicleShadow,
  compareVoucherGateShadow,
  type ShadowDispatchLineInput,
} from "@/lib/trip-cost-engine/shadow-compare";
import {
  beginShadowSession,
  configureShadowLogger,
  endShadowSession,
  logTripCostShadowDiffs,
} from "@/lib/trip-cost-engine/shadow-logger";
import { shouldUseLegacyTripCostOutput } from "@/lib/trip-cost-engine/config";
import {
  buildMonthShadowSummary,
  classifyFeaturedRoute,
  formatShadowMarkdownReport,
  type TripShadowSnapshotRow,
} from "@/lib/trip-cost-engine/shadow-snapshot-report";

const YEAR = Number(process.env.SNAPSHOT_YEAR ?? "2026");
const MONTH = Number(process.env.SNAPSHOT_MONTH ?? "6");
const OUT_DIR = join(process.cwd(), "artifacts");

function parseArgs() {
  let year = YEAR;
  let month = MONTH;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--year=")) year = Number(arg.split("=")[1]);
    if (arg.startsWith("--month=")) month = Number(arg.split("=")[1]);
  }
  return { year, month };
}

async function loadSnapshotMasterData(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);
  const [routes, globalCosts, trucks, unloadingFees, loadingFees, vouchers] =
    await Promise.all([
      prisma.routeMaster.findMany({
        where: { active: true },
        select: {
          code: true,
          markets: true,
          sadooMileageKm: true,
          tollFee: true,
          tollFeeClass2: true,
          tollFeeClass3: true,
          fishCheckingFee: true,
          parkingFee: true,
        },
      }),
      loadGlobalTripCostValues(),
      prisma.truck.findMany({
        where: { active: true, country: "MY" },
        include: { costItems: true },
      }),
      prisma.unloadingFee.findMany({
        where: { tripDate: { gte: start, lte: end } },
        select: {
          tripId: true,
          unloadFee: true,
          unloadFeeOverride: true,
          kpbFee: true,
          kpbFeeOverride: true,
          isKpbExempt: true,
        },
      }),
      prisma.crateLoadingFee.findMany({
        where: { tripDate: { gte: start, lte: end } },
        select: {
          tripId: true,
          loadingFee: true,
          loadingFeeOverride: true,
        },
      }),
      prisma.driverVoucher.findMany({
        where: { tripDate: { gte: start, lte: end } },
        select: {
          tripId: true,
          status: true,
          costAppliedAt: true,
          chopBorderAmt: true,
          chopBorderActual: true,
          parkingAmt: true,
          parkingActual: true,
          fishCheckAmt: true,
          fishCheckActual: true,
          kpbActual: true,
          upahTurunActual: true,
        },
      }),
    ]);

  const routeRows: RouteMasterCostRow[] = routes.map((route) => ({
    code: route.code,
    markets: route.markets,
    sadooMileageKm: decimalToNumber(route.sadooMileageKm),
    tollFee: decimalToNumber(route.tollFee),
    tollFeeClass2: decimalToNumber(route.tollFeeClass2),
    tollFeeClass3: decimalToNumber(route.tollFeeClass3),
    fishCheckingFee: decimalToNumber(route.fishCheckingFee),
    parkingFee: decimalToNumber(route.parkingFee),
  }));

  const truckById = new Map(
    trucks.map((truck) => [
      truck.id,
      {
        fuelEfficiencyKmPerL: decimalToNumber(truck.fuelEfficiencyKmPerL),
        annualMileageKm: decimalToNumber(truck.annualMileageKm),
        costItems: truck.costItems.map((item) => ({
          annualAmount: decimalToNumber(item.annualAmount) ?? 0,
        })),
        tollClass: truck.tollClass,
      },
    ])
  );

  const unloadingByTripId = new Map<string, typeof unloadingFees>();
  for (const row of unloadingFees) {
    const list = unloadingByTripId.get(row.tripId) ?? [];
    list.push(row);
    unloadingByTripId.set(row.tripId, list);
  }

  const loadingByTripId = new Map<string, typeof loadingFees>();
  for (const row of loadingFees) {
    const list = loadingByTripId.get(row.tripId) ?? [];
    list.push(row);
    loadingByTripId.set(row.tripId, list);
  }

  const voucherByTripId = new Map(vouchers.map((v) => [v.tripId, v]));

  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { notIn: ["draft", "cancelled"] },
      date: { gte: start, lte: end },
    },
    select: {
      id: true,
      truckId: true,
      markets: true,
      lines: {
        select: {
          inboundLine: {
            select: {
              id: true,
              quantity: true,
              dispatchStatus: true,
              mcDeliveryMode: true,
              stall: { select: { market: { select: { code: true } } } },
              session: {
                select: {
                  shipperId: true,
                  shipper: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const dispatchById = new Map(dispatches.map((d) => [d.id, d]));

  return {
    routeRows,
    globalCosts,
    truckById,
    unloadingByTripId,
    loadingByTripId,
    voucherByTripId,
    dispatchById,
  };
}

function buildDispatchLines(dispatch: {
  lines: Array<{
    inboundLine: {
      id: string;
      quantity: unknown;
      dispatchStatus: string;
      mcDeliveryMode: string | null;
      stall: { market: { code: string } | null };
      session: { shipperId: string; shipper: { name: string } };
    } | null;
  }>;
}): ShadowDispatchLineInput[] {
  const lines: ShadowDispatchLineInput[] = [];
  for (const row of dispatch.lines) {
    const line = row.inboundLine;
    if (!line || line.dispatchStatus !== "assigned") continue;
    const marketCode = line.stall.market?.code ?? "";
    if (!marketCode) continue;
    const quantity = decimalToNumber(line.quantity) ?? 0;
    if (quantity <= 0) continue;
    lines.push({
      lineId: line.id,
      shipperId: line.session.shipperId,
      shipperName: line.session.shipper.name,
      marketCode,
      quantity,
      mcDeliveryMode: line.mcDeliveryMode,
    });
  }
  return lines;
}

async function main() {
  const { year, month } = parseArgs();

  reloadTripCostEngineConfig({
    VEHICLE_ALLOC_MODE: process.env.VEHICLE_ALLOC_MODE ?? "shadow",
    VOUCHER_COST_MODE: process.env.VOUCHER_COST_MODE ?? "shadow",
  });

  configureShadowLogger({
    outputPath: join(OUT_DIR, `cost-shadow-${year}-${String(month).padStart(2, "0")}.jsonl`),
    verbose: false,
  });
  beginShadowSession(`june-${year}-${month}-snapshot`);

  console.log(
    `Snapshot trip costs: ${year}-${String(month).padStart(2, "0")} (output mode: ${shouldUseLegacyTripCostOutput() ? "legacy" : "enforced"})`
  );

  const master = await loadSnapshotMasterData(year, month);
  const mileageIssues = auditRouteMileageMaster(master.routeRows);
  const pnlTrips = await loadPnlDispatchTripRowsForPeriod(year, month);

  const snapshotRows: TripShadowSnapshotRow[] = [];

  for (const trip of pnlTrips) {
    const dispatch = master.dispatchById.get(trip.dispatchOrderId);
    if (!dispatch) continue;

    const truck = master.truckById.get(dispatch.truckId);
    const mcLines = mcAssignedLinesFromDispatchLines(dispatch.lines);
    const effectiveMarkets = effectiveMarketsForTripCost(
      dispatch.markets,
      mcLines
    );
    const applicableRoutes = findApplicableRoutes(
      effectiveMarkets,
      master.routeRows
    );
    const routeCosts = computeTripRouteCosts(
      applicableRoutes,
      master.globalCosts,
      truck?.tollClass
    );

    const voucher = master.voucherByTripId.get(trip.dispatchOrderId);
    const unloadingRows =
      master.unloadingByTripId.get(trip.dispatchOrderId) ?? [];
    const loadingRows = master.loadingByTripId.get(trip.dispatchOrderId) ?? [];

    const dispatchLines = buildDispatchLines(dispatch);
    const marketQuantities: Record<string, number> = {};
    for (const line of dispatchLines) {
      const group = line.marketCode;
      marketQuantities[group] = (marketQuantities[group] ?? 0) + line.quantity;
    }

    const compareInput = {
      tripId: trip.dispatchOrderId,
      dispatchMarkets: dispatch.markets,
      dispatchLines,
      routes: master.routeRows,
      globalCosts: {
        borderPass: master.globalCosts.borderPass,
        epermit: master.globalCosts.epermit,
        dagangNet: master.globalCosts.dagangNet,
        forwardingOutbound: master.globalCosts.forwardingOutbound,
        fuelPriceMyr: master.globalCosts.fuelPriceMyr,
      },
      tollClass: truck?.tollClass,
      truck: truck ?? null,
      driverMyr: trip.vehicleCosts.driverMyr,
      tripBorderMyr: trip.vehicleCosts.borderPassMyr,
      tripFishMyr:
        voucher?.fishCheckActual ??
        voucher?.fishCheckAmt ??
        routeCosts.fishCheckingFee,
      unloadingRows,
      loadingRows,
      routeCosts: {
        epermit: routeCosts.epermit,
        dagangNet: routeCosts.dagangNet,
        forwarding: routeCosts.forwarding,
      },
      voucher: voucher
        ? {
            status: voucher.status,
            costAppliedAt: voucher.costAppliedAt,
            chopBorderAmt: voucher.chopBorderAmt,
            chopBorderActual: voucher.chopBorderActual,
            parkingAmt: voucher.parkingAmt,
            parkingActual: voucher.parkingActual,
            fishCheckAmt: voucher.fishCheckAmt,
            fishCheckActual: voucher.fishCheckActual,
            kpbActual: voucher.kpbActual,
            upahTurunActual: voucher.upahTurunActual,
          }
        : null,
      routeEstimates: {
        borderPassMyr: routeCosts.borderPass,
        parkingMyr: routeCosts.parkingFee,
        fishCheckingMyr: routeCosts.fishCheckingFee,
      },
      legacyShippers: trip.shippers.map((s) => ({
        shipperId: s.shipperId,
        shipperName: s.shipperName,
        quantity: s.quantity,
        allocatedCostMyr: s.allocatedCostMyr,
      })),
    };

    const vehicle = compareTripVehicleShadow(compareInput);
    const voucherGate = compareVoucherGateShadow(compareInput);
    logTripCostShadowDiffs(buildVehicleShadowDiffs(trip.dispatchOrderId, vehicle));

    const featured = classifyFeaturedRoute(trip.routeGroups);

    snapshotRows.push({
      tripId: trip.dispatchOrderId,
      date: trip.date,
      truckPlate: trip.truckPlate,
      routeLabel: trip.routeLabel || getRouteLabel(dispatch.markets),
      routeGroups: trip.routeGroups,
      marketQuantities,
      voucherStatus: voucher?.status ?? null,
      vehicle,
      voucherGate,
      featured: featured.featured,
      featuredLabel: featured.label,
    });
  }

  const summary = buildMonthShadowSummary(
    snapshotRows,
    mileageIssues,
    year,
    month
  );
  const markdown = formatShadowMarkdownReport(summary);

  mkdirSync(OUT_DIR, { recursive: true });
  const tag = `${year}-${String(month).padStart(2, "0")}`;
  const jsonPath = join(OUT_DIR, `cost-shadow-snapshot-${tag}.json`);
  const mdPath = join(OUT_DIR, `cost-shadow-snapshot-${tag}.md`);

  writeFileSync(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  writeFileSync(mdPath, markdown, "utf8");

  endShadowSession(`june-${year}-${month}-snapshot`, {
    tripCount: summary.tripCount,
    conservationFailCount: summary.conservationFailCount,
    vehicleTotalDeltaMyr: summary.vehicleTotalDeltaMyr,
  });

  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(
    `\nSummary: ${summary.tripCount} trips | conservation OK ${summary.conservationPassCount} / fail ${summary.conservationFailCount} | vehicle pool Δ ${summary.vehicleTotalDeltaMyr.toFixed(2)} MYR`
  );
  console.log(`Featured routes for boss review: ${summary.featuredTrips.length}`);
  for (const t of summary.featuredTrips) {
    console.log(
      `  - ${t.featuredLabel}: ${t.date} ${t.truckPlate} legacy=${t.vehicle.legacy.totalMyr.toFixed(2)} enforced=${t.vehicle.enforced.totalMyr.toFixed(2)}`
    );
  }
  if (mileageIssues.length > 0) {
    console.log(`\nMileage data issues: ${mileageIssues.length}`);
    for (const issue of mileageIssues) {
      console.log(`  - [${issue.issue}] ${issue.routeGroup}: ${issue.detail}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
