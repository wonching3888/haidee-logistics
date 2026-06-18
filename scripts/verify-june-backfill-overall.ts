/**
 * Post-backfill verification for June 2026 freight snapshot repair.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, existsSync } from "fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import { decimalToNumber } from "../lib/freight-rates";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import {
  buildPnlPeriodSummary,
  buildPnlCustomerAnalysis,
} from "../lib/pnl-report";
import { freightAmountMyrEquivalent } from "../lib/inbound-freight";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "../lib/inbound-freight";
import { loadInboundFreightContext } from "../lib/freight-context";
import { resolveSessionPickupLocation } from "../lib/constants/pickup-locations";

const YEAR = 2026;
const MONTH = 6;
const RATE_AS_OF = "2026-06-15";
const BEFORE_PNL_REVENUE = 289_936.17; // from June audit pre-backfill

const BACKUP_660 = join(
  process.cwd(),
  "scripts",
  "backup-660-rows-pre-1.5b-2026-06-17.json"
);
const BACKUP_373 = join(
  process.cwd(),
  "scripts",
  "backup-373-rows-rate-gap-2026-06-17.json"
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function loadBackup(path: string) {
  if (!existsSync(path)) throw new Error(`Missing backup: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as {
    lineCount: number;
    sessionCount: number;
    lines: Array<{ id: string; sessionId: string; sessionNo: string }>;
  };
}

async function modeLineCounts(start: Date, end: Date) {
  const modes = [
    {
      mode: "1a",
      where: {
        paymentMode: "1a",
        billingCompany: "haidee",
        currency: "THB",
        freightAmount: { gt: 0 },
        session: { status: "confirmed" as const, date: { gte: start, lte: end } },
      },
    },
    {
      mode: "1b",
      where: {
        paymentMode: "1b",
        billingCompany: "haidee",
        currency: "MYR",
        freightAmount: { gt: 0 },
        session: { status: "confirmed" as const, date: { gte: start, lte: end } },
      },
    },
    {
      mode: "2",
      where: {
        paymentMode: "2",
        billingCompany: "haidee",
        currency: "MYR",
        freightAmount: { gt: 0 },
        session: { status: "confirmed" as const, date: { gte: start, lte: end } },
      },
    },
    {
      mode: "3",
      where: {
        paymentMode: "3",
        billingCompany: "wtl",
        currency: "MYR",
        freightAmount: { gt: 0 },
        session: { status: "confirmed" as const, date: { gte: start, lte: end } },
      },
    },
    {
      mode: "4",
      where: {
        billingCompany: "wtl",
        currency: "MYR",
        paymentMode: { not: "3" },
        freightAmount: { gt: 0 },
        session: { status: "confirmed" as const, date: { gte: start, lte: end } },
      },
    },
  ];

  const result: Record<string, { lines: number; freightSum: number }> = {};
  for (const m of modes) {
    const agg = await prisma.inboundLine.aggregate({
      where: m.where,
      _count: { _all: true },
      _sum: { freightAmount: true },
    });
    result[m.mode] = {
      lines: agg._count._all,
      freightSum: round2(Number(agg._sum.freightAmount ?? 0)),
    };
  }
  return result;
}

async function main() {
  const b660 = loadBackup(BACKUP_660);
  const b373 = loadBackup(BACKUP_373);
  const ids660 = new Set(b660.lines.map((l) => l.id));
  const ids373 = new Set(b373.lines.map((l) => l.id));
  const overlap = [...ids373].filter((id) => ids660.has(id));
  const batchIds = new Set([...ids660, ...ids373]);
  const sessions660 = new Set(b660.lines.map((l) => l.sessionId));
  const sessions373 = new Set(b373.lines.map((l) => l.sessionId));
  const sessionOverlap = [...sessions373].filter((s) => sessions660.has(s));

  const { start, end } = getMonthDateRange(YEAR, MONTH);

  const totalConfirmed = await prisma.inboundLine.count({
    where: { session: { status: "confirmed", date: { gte: start, lte: end } } },
  });
  const withFreight = await prisma.inboundLine.count({
    where: {
      session: { status: "confirmed", date: { gte: start, lte: end } },
      freightAmount: { gt: 0 },
    },
  });
  const assignedNullFreight = await prisma.inboundLine.count({
    where: {
      session: { status: "confirmed", date: { gte: start, lte: end } },
      dispatchStatus: "assigned",
      freightAmount: null,
    },
  });

  const period = await buildPnlPeriodSummary({ year: YEAR, month: MONTH });
  const customers = await buildPnlCustomerAnalysis({ year: YEAR, month: MONTH });
  const customerRevenue = round2(
    customers.customers.reduce((s, c) => s + c.revenueMyr, 0)
  );

  const modeCounts = await modeLineCounts(start, end);

  // Remaining config gaps among assigned null freight
  const rateAsOf = new Date(`${RATE_AS_OF}T00:00:00.000Z`);
  const stillNull = await prisma.inboundLine.findMany({
    where: {
      session: { status: "confirmed", date: { gte: start, lte: end } },
      dispatchStatus: "assigned",
      freightAmount: null,
    },
    include: {
      session: {
        select: {
          shipperId: true,
          pickupLocation: true,
          shipper: { select: { code: true, name: true, pickupLocation: true } },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
      tongType: { select: { isBox: true } },
    },
  });

  const gapMap = new Map<
    string,
    { shipper: string; shipperName: string; market: string; reason: string; count: number }
  >();

  for (const line of stillNull) {
    const pickup = resolveSessionPickupLocation(
      line.session.pickupLocation,
      line.session.shipper.pickupLocation
    );
    const { ctx } = await loadInboundFreightContext(
      line.session.shipperId,
      [line.stallId],
      [line.tongTypeId],
      rateAsOf,
      pickup
    );
    const market = line.stall.market?.code ?? "";
    const snap = computeInboundLineFreight(
      {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode: normalizeMcDeliveryMode(market, line.mcDeliveryMode),
      },
      ctx
    );
    const gap =
      classifyInboundFreightGap(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(market, line.mcDeliveryMode),
        },
        ctx,
        snap
      ) ?? "unknown";

    const key = `${line.session.shipper.code}|${market}|${gap}`;
    const row = gapMap.get(key);
    if (row) row.count += 1;
    else
      gapMap.set(key, {
        shipper: line.session.shipper.code,
        shipperName: line.session.shipper.name,
        market,
        reason: gap,
        count: 1,
      });
  }

  // MYR equivalent added from backups (post-backfill current on batch lines)
  const batchLines = await prisma.inboundLine.findMany({
    where: { id: { in: [...batchIds] } },
    select: {
      freightAmount: true,
      currency: true,
      exchangeRate: true,
      mySegmentFreightAmount: true,
      thFreightAmount: true,
    },
  });
  const batchFreightMyr = round2(
    batchLines.reduce((s, l) => {
      const myr = freightAmountMyrEquivalent({
        freightAmount: decimalToNumber(l.freightAmount),
        currency: l.currency,
        exchangeRate: decimalToNumber(l.exchangeRate),
        mySegmentFreightAmount: decimalToNumber(l.mySegmentFreightAmount),
        thFreightAmount: decimalToNumber(l.thFreightAmount),
      });
      return s + (myr ?? 0);
    }, 0)
  );

  const unaffectedCount = totalConfirmed - batchIds.size;

  const report = {
    scope: {
      batch660Lines: ids660.size,
      batch373Lines: ids373.size,
      batchTotal: batchIds.size,
      lineIdOverlap: overlap.length,
      sessionOverlap: sessionOverlap.length,
      totalConfirmedJuneLines: totalConfirmed,
      unaffectedLineCount: unaffectedCount,
    },
    pnl: {
      before: {
        revenueMyr: BEFORE_PNL_REVENUE,
        note: "From pre-backfill June audit (2026-06-17)",
      },
      after: {
        revenueMyr: period.periodSummary.revenueMyr,
        costMyr: period.periodSummary.costMyr,
        grossProfitMyr: period.periodSummary.grossProfitMyr,
        customerRevenueMyr: customerRevenue,
      },
      delta: {
        revenueMyr: round2(period.periodSummary.revenueMyr - BEFORE_PNL_REVENUE),
        costMyr: null,
        grossProfitMyr: null,
        note: "Cost/gross profit before snapshot not captured; revenue delta is primary metric",
      },
      batchFreightMyrEquivalent: batchFreightMyr,
    },
    invoiceCoverage: {
      before: { invoiceableLines: 789, totalConfirmed: 1977, pct: round2((789 / 1977) * 100) },
      after: {
        invoiceableLines: withFreight,
        totalConfirmed,
        pct: round2((withFreight / totalConfirmed) * 100),
      },
      deltaLines: withFreight - 789,
      modes: modeCounts,
    },
    remainingGaps: {
      assignedNullFreightTotal: assignedNullFreight,
      configGapBreakdown: [...gapMap.values()].sort((a, b) => b.count - a.count),
    },
  };

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
