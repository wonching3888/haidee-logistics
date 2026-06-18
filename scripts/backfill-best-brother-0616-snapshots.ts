/**
 * Fix BEST BROTHER IN-20260616-018 (5 lines): billing_company haidee → wtl (Mode 4).
 * HISTORICAL ARCHIVE — completed 2026-06-18. Re-run requires restoring
 * temporary hooks (__BACKFILL_USER__, BACKFILL_SKIP_REVALIDATE, freightRateAsOfDate).
 *
 * Usage: node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/backfill-best-brother-0616-snapshots.ts [--step=audit|backup|resave|verify|all]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import type { AppUser } from "../types";
import { decimalToNumber } from "../lib/freight-rates";
import { getMonthlyInvoiceModeConfig } from "../lib/constants/monthly-invoice";
import { buildMonthlyInvoiceData } from "../lib/monthly-invoice";
import { buildPnlPeriodSummary } from "../lib/pnl-report";
import { getMonthDateRange } from "../lib/reports/period-report-shared";

const SHIPPER_CODE = "3000-B002";
const SESSION_NO = "IN-20260616-018";
const RATE_AS_OF_DATE = "2026-06-15";
const YEAR = 2026;
const MONTH = 6;

const BACKUP_PATH = join(
  process.cwd(),
  "scripts",
  "backup-best-brother-0616-5-rows-2026-06-18.json"
);

const LINE_IDS = [
  "2727579a-4335-46ac-ae9a-27b8c37346ff",
  "ba9084da-e92b-4d84-a01d-c6717a79403d",
  "0227e4ac-15ce-45b0-98ae-8d51372aa8c9",
  "ab61f435-93c4-4227-8036-10e92330ae6f",
  "0d811b89-04fd-4658-b8b3-0f84dad8bb0f",
] as const;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function stepArg() {
  const arg = process.argv.find((a) => a.startsWith("--step="));
  return arg?.split("=")[1] ?? "all";
}

async function fetchTargetLines() {
  return prisma.inboundLine.findMany({
    where: { id: { in: [...LINE_IDS] } },
    include: {
      session: {
        select: {
          id: true,
          sessionNo: true,
          date: true,
          status: true,
          shipperId: true,
          thVehiclePlate: true,
          areaNote: true,
          pickupLocation: true,
          createdAt: true,
          shipper: {
            select: { code: true, name: true, currency: true, company: true, createdAt: true },
          },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
      tongType: { select: { code: true, isBox: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

function serializeLine(line: Awaited<ReturnType<typeof fetchTargetLines>>[number]) {
  return {
    id: line.id,
    sessionNo: line.session.sessionNo,
    sessionDate: line.session.date.toISOString().slice(0, 10),
    marketCode: line.stall.market?.code ?? "",
    quantity: line.quantity,
    paymentMode: line.paymentMode,
    currency: line.currency,
    billingCompany: line.billingCompany,
    freightRate: decimalToNumber(line.freightRate),
    freightAmount: decimalToNumber(line.freightAmount),
    thFreightRate: decimalToNumber(line.thFreightRate),
    thFreightAmount: decimalToNumber(line.thFreightAmount),
    mySegmentFreightRate: decimalToNumber(line.mySegmentFreightRate),
    mySegmentFreightAmount: decimalToNumber(line.mySegmentFreightAmount),
    createdAt: line.createdAt.toISOString(),
  };
}

function isCorrectSnapshot(line: {
  paymentMode: string | null;
  currency: string | null;
  billingCompany: string | null;
  freightAmount: unknown;
  thFreightAmount: unknown;
  mySegmentFreightAmount: unknown;
}) {
  return (
    line.paymentMode === "1b" &&
    line.currency === "MYR" &&
    line.billingCompany === "wtl" &&
    (decimalToNumber(line.freightAmount) ?? 0) > 0 &&
    decimalToNumber(line.thFreightAmount) != null &&
    decimalToNumber(line.mySegmentFreightAmount) != null
  );
}

async function fetchSessionMode4Invoice(sessionNo: string, shipperId: string) {
  const mode = getMonthlyInvoiceModeConfig("4");
  if (!mode) throw new Error("mode 4 config missing");
  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const rawLines = await prisma.inboundLine.findMany({
    where: {
      billingCompany: mode.billingCompany,
      currency: mode.currency,
      freightAmount: { gt: 0 },
      session: {
        status: "confirmed",
        date: { gte: start, lte: end },
        sessionNo,
        shipperId,
      },
    },
    include: {
      session: {
        select: {
          date: true,
          sessionNo: true,
          shipper: { select: { id: true, code: true, name: true } },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
      tongType: { select: { code: true, isBox: true } },
      consignee: { select: { id: true, code: true, name: true } },
    },
  });

  const mapped = rawLines.map((line) => ({
    sessionDate: line.session.date,
    sessionNo: line.session.sessionNo,
    stallMarketCode: line.stall.market?.code ?? "",
    stallCode: line.stall.code,
    stallName: line.stall.name,
    tongTypeCode: line.tongType.code,
    quantity: line.quantity,
    freightRate: decimalToNumber(line.freightRate),
    freightAmount: decimalToNumber(line.freightAmount),
    thFreightRate: decimalToNumber(line.thFreightRate),
    thFreightAmount: decimalToNumber(line.thFreightAmount),
    mySegmentFreightRate: decimalToNumber(line.mySegmentFreightRate),
    mySegmentFreightAmount: decimalToNumber(line.mySegmentFreightAmount),
    isBox: line.isBox,
    shipperId: line.session.shipper.id,
    shipperCode: line.session.shipper.code,
    shipperName: line.session.shipper.name,
    consigneeId: line.consigneeId ?? line.consignee?.id ?? null,
    consigneeCode: line.consignee?.code ?? null,
    consigneeName: line.consignee?.name ?? null,
  }));

  const data = buildMonthlyInvoiceData({
    mode,
    year: YEAR,
    month: MONTH,
    periodLabel: `${YEAR}年${MONTH}月`,
    customerId: shipperId,
    rawLines: mapped,
  });

  return {
    rawLineCount: mapped.length,
    invoice: data
      ? {
          grandTotalMyr: data.grandTotalAmount,
          thTotalMyr: data.grandThTotalAmount,
          myTotalMyr: data.grandMyTotalAmount,
          lineCount: data.sections.reduce((sum, s) => sum + s.lines.length, 0),
        }
      : null,
  };
}

async function setupAuthMock() {
  const admin =
    (await prisma.user.findFirst({
      where: { role: "admin" },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!admin) throw new Error("No user found for auth mock");

  (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__ = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: "admin",
  };
}

async function stepAudit() {
  const shipper = await prisma.shipper.findUnique({
    where: { code: SHIPPER_CODE },
    select: {
      code: true,
      name: true,
      currency: true,
      company: true,
      createdAt: true,
    },
  });

  const lines = await fetchTargetLines();
  const session = lines[0]?.session;

  console.log(
    JSON.stringify(
      {
        shipper,
        session: session
          ? {
              sessionNo: session.sessionNo,
              sessionDate: session.date.toISOString().slice(0, 10),
              sessionCreatedAt: session.createdAt.toISOString(),
            }
          : null,
        lineCount: lines.length,
        wrongBilling: lines.filter((l) => l.billingCompany !== "wtl").length,
        lines: lines.map(serializeLine),
        rootCause:
          "Session entered 2026-06-15 16:29 before WTL isWtl rates/company snapshot applied at save; lines kept billing_company=haidee with non-WTL freight amounts. Resave applies current master (company=wtl, isWtl dual-segment).",
        expectedAfterResave:
          "payment_mode=1b, currency=MYR, billing_company=wtl, WTL TH+MY segment amounts",
      },
      null,
      2
    )
  );
}

async function stepBackup() {
  const lines = await fetchTargetLines();
  const pnlBefore = await buildPnlPeriodSummary({ year: YEAR, month: MONTH });

  const payload = {
    exportedAt: new Date().toISOString(),
    criteria: `BEST BROTHER ${SESSION_NO} — 5 lines billing_company=haidee (should be wtl / Mode 4)`,
    lineCount: lines.length,
    lines: lines.map(serializeLine),
    freightTotalBefore: round2(
      lines.reduce((s, l) => s + (decimalToNumber(l.freightAmount) ?? 0), 0)
    ),
    pnlJune2026: {
      revenueMyr: pnlBefore.periodSummary.revenueMyr,
      costMyr: pnlBefore.periodSummary.costMyr,
      grossProfitMyr: pnlBefore.periodSummary.grossProfitMyr,
    },
  };

  writeFileSync(BACKUP_PATH, JSON.stringify(payload, null, 2));
  console.log(`Backup written: ${BACKUP_PATH}`);
}

async function stepResave() {
  const session = await prisma.inboundSession.findFirst({
    where: { sessionNo: SESSION_NO },
    include: {
      lines: {
        include: {
          stall: { include: { market: { select: { code: true } } } },
          tongType: { select: { code: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) throw new Error(`Session not found: ${SESSION_NO}`);

  await setupAuthMock();
  process.env.BACKFILL_SKIP_REVALIDATE = "1";
  const { saveInboundSession } = await import("../app/actions/inbound");

  const inputLines = session.lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({
      stallId: l.stallId,
      tongTypeId: l.tongTypeId,
      quantity: l.quantity,
      lineId: l.id,
      mcDeliveryMode:
        (l.mcDeliveryMode as "self" | "third_party" | null) ?? undefined,
    }));

  const result = await saveInboundSession({
    date: session.date.toISOString().slice(0, 10),
    shipperId: session.shipperId,
    thVehiclePlate: session.thVehiclePlate ?? undefined,
    areaNote: session.areaNote ?? undefined,
    pickupLocation: session.pickupLocation,
    lines: inputLines,
    asDraft: false,
    sessionId: session.id,
    freightRateAsOfDate: RATE_AS_OF_DATE,
  });

  console.log(result.ok ? "Resave OK" : `Resave FAIL: ${result.error}`);
}

async function stepVerify() {
  const lines = await fetchTargetLines();
  const allCorrect = lines.every((l) => isCorrectSnapshot(l));

  const shipper = await prisma.shipper.findUnique({
    where: { code: SHIPPER_CODE },
    select: { id: true },
  });
  if (!shipper) throw new Error("shipper not found");

  const mode4Invoice = await fetchSessionMode4Invoice(SESSION_NO, shipper.id);

  const freightAfter = round2(
    lines.reduce((s, l) => s + (decimalToNumber(l.freightAmount) ?? 0), 0)
  );

  let backup: {
    freightTotalBefore: number;
    pnlJune2026: { revenueMyr: number; costMyr: number; grossProfitMyr: number };
  } | null = null;
  if (existsSync(BACKUP_PATH)) {
    backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8"));
  }
  const pnlAfter = await buildPnlPeriodSummary({ year: YEAR, month: MONTH });

  console.log(
    JSON.stringify(
      {
        allCorrect,
        lines: lines.map(serializeLine),
        freightTotalMyr: freightAfter,
        freightDeltaFromBackup: backup
          ? round2(freightAfter - backup.freightTotalBefore)
          : null,
        mode4Invoice,
        pnlJune2026: {
          before: backup?.pnlJune2026 ?? null,
          after: {
            revenueMyr: pnlAfter.periodSummary.revenueMyr,
            costMyr: pnlAfter.periodSummary.costMyr,
            grossProfitMyr: pnlAfter.periodSummary.grossProfitMyr,
          },
          delta: backup
            ? {
                revenueMyr: round2(
                  pnlAfter.periodSummary.revenueMyr -
                    backup.pnlJune2026.revenueMyr
                ),
                costMyr: round2(
                  pnlAfter.periodSummary.costMyr - backup.pnlJune2026.costMyr
                ),
                grossProfitMyr: round2(
                  pnlAfter.periodSummary.grossProfitMyr -
                    backup.pnlJune2026.grossProfitMyr
                ),
              }
            : null,
        },
      },
      null,
      2
    )
  );

  if (!allCorrect) throw new Error("BB lines still have wrong snapshots");
  if (!mode4Invoice.invoice || mode4Invoice.rawLineCount !== 5) {
    throw new Error("Session not found in Mode 4 invoice");
  }
}

async function main() {
  const step = stepArg();
  if (step === "audit" || step === "all") await stepAudit();
  if (step === "backup" || step === "all") await stepBackup();
  if (step === "resave" || step === "all") await stepResave();
  if (step === "verify" || step === "all") await stepVerify();

  delete (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__;
  delete process.env.BACKFILL_SKIP_REVALIDATE;
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
