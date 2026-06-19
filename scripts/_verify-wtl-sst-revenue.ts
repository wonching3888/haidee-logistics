/**
 * Verify WTL SST exclusion on P&L + operations income (June 2026 live data).
 * Run: node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/_verify-wtl-sst-revenue.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { buildPnlPeriodSummary } from "../lib/pnl-report";
import { aggregateOperationsIncome } from "../lib/operations-income";
import { clearPnlMonthTripsCache } from "../lib/pnl-month-cache";
import { lineRevenueMyr } from "../lib/wtl-revenue";
import {
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "../lib/inbound-freight";
import { loadInboundFreightContext } from "../lib/freight-context";
import { resolveSessionPickupLocation } from "../lib/constants/pickup-locations";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import { prisma } from "../lib/prisma";
import { decimalToNumber } from "../lib/freight-rates";
import { isOtherMarket } from "../lib/markets";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function lineRevenueInclusive(
  snapshot: Parameters<typeof lineRevenueMyr>[0],
  exchangeRate: number
) {
  return lineRevenueMyr(
    snapshot,
    exchangeRate,
    new Date("2026-05-31T00:00:00.000Z")
  );
}

async function sumPnlWtlRevenue(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);
  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { notIn: ["draft", "cancelled"] },
      date: { gte: start, lte: end },
    },
    select: {
      date: true,
      lines: {
        select: {
          inboundLine: {
            select: {
              stallId: true,
              tongTypeId: true,
              quantity: true,
              dispatchStatus: true,
              mcDeliveryMode: true,
              tongType: { select: { code: true } },
              session: {
                select: {
                  shipperId: true,
                  pickupLocation: true,
                  shipper: { select: { pickupLocation: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const ctxMap = new Map<
    string,
    Awaited<ReturnType<typeof loadInboundFreightContext>>["ctx"]
  >();
  const freightReqs = new Map<
    string,
    { shipperId: string; pickup: string; stalls: Set<string>; tongs: Set<string> }
  >();

  for (const dispatch of dispatches) {
    for (const row of dispatch.lines) {
      const line = row.inboundLine;
      if (!line || line.dispatchStatus !== "assigned") continue;
      const pickup = resolveSessionPickupLocation(
        line.session.pickupLocation,
        line.session.shipper.pickupLocation
      );
      const key = `${line.session.shipperId}|${pickup}`;
      const req = freightReqs.get(key) ?? {
        shipperId: line.session.shipperId,
        pickup,
        stalls: new Set(),
        tongs: new Set(),
      };
      req.stalls.add(line.stallId);
      req.tongs.add(line.tongTypeId);
      freightReqs.set(key, req);
    }
  }

  for (const req of freightReqs.values()) {
    const key = `${req.shipperId}|${req.pickup}`;
    ctxMap.set(
      key,
      (
        await loadInboundFreightContext(
          req.shipperId,
          [...req.stalls],
          [...req.tongs],
          end,
          req.pickup as ReturnType<typeof resolveSessionPickupLocation>
        )
      ).ctx
    );
  }

  let wtlInclusive = 0;
  let wtlExSst = 0;

  for (const dispatch of dispatches) {
    const byShipper = new Map<string, NonNullable<(typeof dispatches)[0]["lines"][0]["inboundLine"]>[]>();
    for (const row of dispatch.lines) {
      const line = row.inboundLine;
      if (!line || line.dispatchStatus !== "assigned") continue;
      const g = byShipper.get(line.session.shipperId) ?? [];
      g.push(line);
      byShipper.set(line.session.shipperId, g);
    }

    for (const [shipperId, lines] of byShipper) {
      const first = lines[0]!;
      const pickup = resolveSessionPickupLocation(
        first.session.pickupLocation,
        first.session.shipper.pickupLocation
      );
      const ctx = ctxMap.get(`${shipperId}|${pickup}`);
      if (!ctx) continue;

      for (const line of lines) {
        if (!line.tongType?.code) continue;
        const mc = ctx.stalls.get(line.stallId)?.marketCode ?? "";
        if (!mc || isOtherMarket(mc)) continue;
        const qty = decimalToNumber(line.quantity) ?? 0;
        if (qty <= 0) continue;
        const snap = computeInboundLineFreight(
          {
            stallId: line.stallId,
            tongTypeId: line.tongTypeId,
            quantity: qty,
            mcDeliveryMode: normalizeMcDeliveryMode(mc, line.mcDeliveryMode),
          },
          ctx
        );
        const inc = lineRevenueInclusive(snap, ctx.exchangeRate);
        const ex = lineRevenueMyr(snap, ctx.exchangeRate, dispatch.date);
        if (
          snap.billingCompany === "wtl" ||
          (snap.dualPaymentWtlAmount ?? 0) > 0
        ) {
          wtlInclusive += inc;
          wtlExSst += ex;
        }
      }
    }
  }

  return {
    wtlInclusive: round2(wtlInclusive),
    wtlExSst: round2(wtlExSst),
    sstRemoved: round2(wtlInclusive - wtlExSst),
  };
}

async function main() {
  clearPnlMonthTripsCache();

  const junePnl = await buildPnlPeriodSummary({ year: 2026, month: 6 });
  const juneOps = await aggregateOperationsIncome(2026, 6);
  const mayPnl = await buildPnlPeriodSummary({ year: 2026, month: 5 });
  const mayOps = await aggregateOperationsIncome(2026, 5);
  const wtl = await sumPnlWtlRevenue(2026, 6);

  const opsWtlTotal = round2(juneOps.wtlMode3Myr + juneOps.wtlShipperMyr);

  console.log(
    JSON.stringify(
      {
        june2026: {
          pnl: {
            revenueMyr: junePnl.periodSummary.revenueMyr,
            grossProfitMyr: junePnl.periodSummary.grossProfitMyr,
            costMyr: junePnl.periodSummary.costMyr,
            tripCount: junePnl.periodSummary.tripCount,
          },
          operations: {
            wtlMode3Myr: juneOps.wtlMode3Myr,
            wtlShipperMyr: juneOps.wtlShipperMyr,
            wtlTotalMyr: opsWtlTotal,
          },
          wtlLineRevenue: wtl,
          diagnosisExpectation: {
            revenueMyr: "~353270.87 (was 354657.80)",
            grossProfitMyr: "~134592.73 (was 135979.66)",
            sstRemovedMyr: "~1386.93",
          },
        },
        may2026HistoricalProtection: {
          pnl: mayPnl.periodSummary,
          operations: {
            wtlMode3Myr: mayOps.wtlMode3Myr,
            wtlShipperMyr: mayOps.wtlShipperMyr,
          },
          note: "May should be unchanged (no dispatches / pre-2026-06-01 gate)",
        },
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
